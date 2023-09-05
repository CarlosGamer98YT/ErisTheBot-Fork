import {
  autoQuote,
  autoRetry,
  bold,
  Bot,
  Context,
  DenoKVAdapter,
  fmt,
  hydrateReply,
  ParseModeFlavor,
  session,
  SessionFlavor,
} from "./deps.ts";
import { fmtArray, formatOrdinal } from "./intl.ts";
import { queue } from "./queue.ts";
import { SdRequest } from "./sd.ts";

type AppContext = ParseModeFlavor<Context> & SessionFlavor<SessionData>;

interface SessionData {
  global: {
    adminUsernames: string[];
    pausedReason: string | null;
    sdApiUrl: string;
    maxUserJobs: number;
    maxJobs: number;
    defaultParams?: Partial<SdRequest>;
  };
  user: {
    steps: number;
    detail: number;
    batchSize: number;
  };
}

export const bot = new Bot<AppContext>(Deno.env.get("TG_BOT_TOKEN") ?? "");
bot.use(autoQuote);
bot.use(hydrateReply);
bot.api.config.use(autoRetry({ maxRetryAttempts: 5, maxDelaySeconds: 60 }));

const db = await Deno.openKv("./app.db");

const getDefaultGlobalSession = (): SessionData["global"] => ({
  adminUsernames: (Deno.env.get("ADMIN_USERNAMES") ?? "").split(",").filter(Boolean),
  pausedReason: null,
  sdApiUrl: Deno.env.get("SD_API_URL") ?? "http://127.0.0.1:7860/",
  maxUserJobs: 3,
  maxJobs: 20,
  defaultParams: {
    batch_size: 1,
    n_iter: 1,
    width: 128 * 2,
    height: 128 * 3,
    steps: 20,
    cfg_scale: 9,
    send_images: true,
    negative_prompt: "boring_e621_fluffyrock_v4 boring_e621_v4",
  },
});

bot.use(session<SessionData, AppContext>({
  type: "multi",
  global: {
    getSessionKey: () => "global",
    initial: getDefaultGlobalSession,
    storage: new DenoKVAdapter(db),
  },
  user: {
    initial: () => ({
      steps: 20,
      detail: 8,
      batchSize: 2,
    }),
  },
}));

export async function getGlobalSession(): Promise<SessionData["global"]> {
  const entry = await db.get<SessionData["global"]>(["sessions", "global"]);
  return entry.value ?? getDefaultGlobalSession();
}

bot.api.setMyShortDescription("I can generate furry images from text");
bot.api.setMyDescription(
  "I can generate furry images from text. Send /txt2img to generate an image.",
);
bot.api.setMyCommands([
  { command: "txt2img", description: "Generate an image" },
  { command: "queue", description: "Show the current queue" },
  { command: "sdparams", description: "Show the current SD parameters" },
]);

bot.command("start", (ctx) => ctx.reply("Hello! Use the /txt2img command to generate an image"));

bot.command("txt2img", async (ctx) => {
  if (!ctx.from?.id) {
    return ctx.reply("I don't know who you are");
  }
  const config = ctx.session.global;
  if (config.pausedReason != null) {
    return ctx.reply(`I'm paused: ${config.pausedReason || "No reason given"}`);
  }
  if (queue.length >= config.maxJobs) {
    return ctx.reply(
      `The queue is full. Try again later. (Max queue size: ${config.maxJobs})`,
    );
  }
  const jobCount = queue.filter((job) => job.userId === ctx.from.id).length;
  if (jobCount >= config.maxUserJobs) {
    return ctx.reply(
      `You already have ${config.maxUserJobs} jobs in queue. Try again later.`,
    );
  }
  if (!ctx.match) {
    return ctx.reply("Please describe what you want to see after the command");
  }
  const place = queue.length + 1;
  const queueMessage = await ctx.reply(`You are ${formatOrdinal(place)} in queue.`);
  const userName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ");
  const chatName = ctx.chat.type === "supergroup" || ctx.chat.type === "group"
    ? ctx.chat.title
    : "private chat";
  queue.push({
    params: { prompt: ctx.match },
    userId: ctx.from.id,
    userName,
    chatId: ctx.chat.id,
    chatName,
    requestMessageId: ctx.message.message_id,
    statusMessageId: queueMessage.message_id,
  });
  console.log(`Enqueued job for ${userName} in chat ${chatName}`);
});

bot.command("queue", (ctx) => {
  if (queue.length === 0) return ctx.reply("Queue is empty");
  return ctx.replyFmt(
    fmt`Current queue:\n\n${
      fmtArray(
        queue.map((job, index) =>
          fmt`${bold(index + 1)}. ${bold(job.userName)} in ${bold(job.chatName)}`
        ),
        "\n",
      )
    }`,
  );
});

bot.command("pause", (ctx) => {
  if (!ctx.from?.username) return;
  const config = ctx.session.global;
  if (!config.adminUsernames.includes(ctx.from.username)) return;
  if (config.pausedReason != null) {
    return ctx.reply(`Already paused: ${config.pausedReason}`);
  }
  config.pausedReason = ctx.match ?? "No reason given";
  return ctx.reply("Paused");
});

bot.command("resume", (ctx) => {
  if (!ctx.from?.username) return;
  const config = ctx.session.global;
  if (!config.adminUsernames.includes(ctx.from.username)) return;
  if (config.pausedReason == null) return ctx.reply("Already running");
  config.pausedReason = null;
  return ctx.reply("Resumed");
});

bot.command("setsdapiurl", async (ctx) => {
  if (!ctx.from?.username) return;
  const config = ctx.session.global;
  if (!config.adminUsernames.includes(ctx.from.username)) return;
  if (!ctx.match) return ctx.reply("Please specify an URL");
  let url: URL;
  try {
    url = new URL(ctx.match);
  } catch {
    return ctx.reply("Invalid URL");
  }
  let resp: Response;
  try {
    resp = await fetch(new URL("config", url));
  } catch (err) {
    return ctx.reply(`Could not connect: ${err}`);
  }
  if (!resp.ok) {
    return ctx.reply(`Could not connect: ${resp.status} ${resp.statusText}`);
  }
  let data: unknown;
  try {
    data = await resp.json();
  } catch {
    return ctx.reply("Invalid response from API");
  }
  if (data != null && typeof data === "object" && "version" in data) {
    config.sdApiUrl = url.toString();
    return ctx.reply(`Now using SD at ${url} running version ${data.version}`);
  } else {
    return ctx.reply("Invalid response from API");
  }
});

bot.command("setsdparam", (ctx) => {
  if (!ctx.from?.username) return;
  const config = ctx.session.global;
  if (!config.adminUsernames.includes(ctx.from.username)) return;
  let [param = "", value] = ctx.match.split("=", 2).map((s) => s.trim());
  if (!param) return ctx.reply("Please specify a parameter");
  if (value == null) return ctx.reply("Please specify a value after the =");
  param = param.toLowerCase().replace(/[\s_]+/g, "");
  if (config.defaultParams == null) config.defaultParams = {};
  switch (param) {
    case "steps": {
      const steps = parseInt(value);
      if (isNaN(steps)) return ctx.reply("Invalid number value");
      if (steps > 100) return ctx.reply("Steps must be less than 100");
      if (steps < 10) return ctx.reply("Steps must be greater than 10");
      config.defaultParams.steps = steps;
      return ctx.reply("Steps set to " + steps);
    }
    case "detail":
    case "cfgscale": {
      const detail = parseInt(value);
      if (isNaN(detail)) return ctx.reply("Invalid number value");
      if (detail > 20) return ctx.reply("Detail must be less than 20");
      if (detail < 1) return ctx.reply("Detail must be greater than 1");
      config.defaultParams.cfg_scale = detail;
      return ctx.reply("Detail set to " + detail);
    }
    case "niter":
    case "niters": {
      const nIter = parseInt(value);
      if (isNaN(nIter)) return ctx.reply("Invalid number value");
      if (nIter > 10) return ctx.reply("Iterations must be less than 10");
      if (nIter < 1) return ctx.reply("Iterations must be greater than 1");
      config.defaultParams.n_iter = nIter;
      return ctx.reply("Iterations set to " + nIter);
    }
    case "batchsize": {
      const batchSize = parseInt(value);
      if (isNaN(batchSize)) return ctx.reply("Invalid number value");
      if (batchSize > 8) return ctx.reply("Batch size must be less than 8");
      if (batchSize < 1) return ctx.reply("Batch size must be greater than 1");
      config.defaultParams.batch_size = batchSize;
      return ctx.reply("Batch size set to " + batchSize);
    }
    case "size": {
      let [width, height] = value.split("x", 2).map((s) => parseInt(s.trim()));
      if (!width || !height || isNaN(width) || isNaN(height)) {
        return ctx.reply("Invalid size value");
      }
      if (width > 2048) return ctx.reply("Width must be less than 2048");
      if (height > 2048) return ctx.reply("Height must be less than 2048");
      // find closest multiple of 64
      width = Math.round(width / 64) * 64;
      height = Math.round(height / 64) * 64;
      if (width <= 0) return ctx.reply("Width too small");
      if (height <= 0) return ctx.reply("Height too small");
      config.defaultParams.width = width;
      config.defaultParams.height = height;
      return ctx.reply(`Size set to ${width}x${height}`);
    }
    case "negativeprompt": {
      config.defaultParams.negative_prompt = value;
      return ctx.reply(`Negative prompt set to: ${value}`);
    }
    default: {
      return ctx.reply("Invalid parameter");
    }
  }
});

bot.command("sdparams", (ctx) => {
  if (!ctx.from?.username) return;
  const config = ctx.session.global;
  return ctx.replyFmt(fmt`Current config:\n\n${
    fmtArray(
      Object.entries(config.defaultParams ?? {}).map(([key, value]) =>
        fmt`${bold(key)} = ${String(value)}`
      ),
      "\n",
    )
  }`);
});

bot.catch((err) => {
  let msg = "Error processing update";
  const { from, chat } = err.ctx;
  if (from?.first_name) msg += ` from ${from.first_name}`;
  if (from?.last_name) msg += ` ${from.last_name}`;
  if (from?.username) msg += ` (@${from.username})`;
  if (chat?.type === "supergroup" || chat?.type === "group") {
    msg += ` in ${chat.title}`;
    if (chat.type === "supergroup" && chat.username) msg += ` (@${chat.username})`;
  }
  console.error(msg, err.error);
});
