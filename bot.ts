import { autoQuote, bold, Bot, Context, hydrateReply, ParseModeFlavor } from "./deps.ts";
import { fmt } from "./intl.ts";
import { getAllJobs, pushJob } from "./queue.ts";
import { mySession, MySessionFlavor } from "./session.ts";

export type MyContext = ParseModeFlavor<Context> & MySessionFlavor;
export const bot = new Bot<MyContext>(Deno.env.get("TG_BOT_TOKEN") ?? "");
bot.use(autoQuote);
bot.use(hydrateReply);
bot.use(mySession);

// Automatically retry bot requests if we get a 429 error
bot.api.config.use(async (prev, method, payload, signal) => {
  let remainingAttempts = 5;
  while (true) {
    const result = await prev(method, payload, signal);
    if (result.ok) return result;
    if (result.error_code !== 429 || remainingAttempts <= 0) return result;
    remainingAttempts -= 1;
    const retryAfterMs = (result.parameters?.retry_after ?? 30) * 1000;
    await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
  }
});

// if error happened, try to reply to the user with the error
bot.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    try {
      await ctx.reply(`Handling update failed: ${err}`, {
        reply_to_message_id: ctx.message?.message_id,
      });
    } catch {
      throw err;
    }
  }
});

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
  const jobs = await getAllJobs();
  if (jobs.length >= config.maxJobs) {
    return ctx.reply(
      `The queue is full. Try again later. (Max queue size: ${config.maxJobs})`,
    );
  }
  const jobCount = jobs.filter((job) => job.user.id === ctx.from.id).length;
  if (jobCount >= config.maxUserJobs) {
    return ctx.reply(
      `You already have ${config.maxUserJobs} jobs in queue. Try again later.`,
    );
  }
  if (!ctx.match) {
    return ctx.reply("Please describe what you want to see after the command");
  }
  pushJob({
    params: { prompt: ctx.match },
    user: ctx.from,
    chat: ctx.chat,
    requestMessage: ctx.message,
    status: { type: "idle" },
  });
  console.log(
    `Enqueued job ${jobs.length + 1} for ${ctx.from.first_name} in ${ctx.chat.type} chat:`,
    ctx.match.replace(/\s+/g, " "),
    "\n",
  );
});

bot.command("queue", async (ctx) => {
  let jobs = await getAllJobs();
  const getMessageText = () => {
    if (jobs.length === 0) return fmt`Queue is empty.`;
    const sortedJobs = [];
    let place = 0;
    for (const job of jobs) {
      if (job.status.type === "idle") place += 1;
      sortedJobs.push({ ...job, place });
    }
    return fmt`Current queue:\n\n${
      sortedJobs.map((job) =>
        fmt`${job.place}. ${bold(job.user.first_name)} in ${job.chat.type} chat ${
          job.status.type === "processing" ? `(${(job.status.progress * 100).toFixed(0)}%)` : ""
        }\n`
      )
    }`;
  };
  const message = await ctx.replyFmt(getMessageText());
  handleFutureUpdates();
  async function handleFutureUpdates() {
    for (let idx = 0; idx < 12; idx++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      jobs = await getAllJobs();
      const formattedMessage = getMessageText();
      await ctx.api.editMessageText(ctx.chat.id, message.message_id, formattedMessage.text, {
        entities: formattedMessage.entities,
      }).catch(() => undefined);
    }
  }
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
  return ctx.replyFmt(
    fmt`Current config:\n\n${
      Object.entries(config.defaultParams ?? {}).map(([key, value]) =>
        fmt`${bold(key)} = ${String(value)}\n`
      )
    }`,
  );
});

bot.command("crash", () => {
  throw new Error("Crash command used");
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
