import { Grammy, GrammyAutoQuote, GrammyFiles, GrammyParseMode, Log } from "../deps.ts";
import { formatUserChat } from "../common/formatUserChat.ts";
import { queueCommand } from "./queueCommand.ts";
import { txt2imgCommand, txt2imgQuestion } from "./txt2imgCommand.ts";
import { pnginfoCommand, pnginfoQuestion } from "./pnginfoCommand.ts";
import { img2imgCommand, img2imgQuestion } from "./img2imgCommand.ts";
import { cancelCommand } from "./cancelCommand.ts";
import { getConfig, setConfig } from "../db/config.ts";

export const logger = () => Log.getLogger();

interface SessionData {
  chat: ChatData;
  user: UserData;
}

interface ChatData {
  language?: string;
}

interface UserData {
  params?: Record<string, string>;
}

export type Context =
  & GrammyFiles.FileFlavor<GrammyParseMode.ParseModeFlavor<Grammy.Context>>
  & Grammy.SessionFlavor<SessionData>;

type WithRetryApi<T extends Grammy.RawApi> = {
  [M in keyof T]: T[M] extends (args: infer P, ...rest: infer A) => infer R
    ? (args: P extends object ? P & { maxAttempts?: number } : P, ...rest: A) => R
    : T[M];
};

type Api = Grammy.Api<WithRetryApi<Grammy.RawApi>>;

export const bot = new Grammy.Bot<Context, Api>(Deno.env.get("TG_BOT_TOKEN")!);

bot.use(GrammyAutoQuote.autoQuote);
bot.use(GrammyParseMode.hydrateReply);
bot.use(Grammy.session<
  SessionData,
  Grammy.Context & Grammy.SessionFlavor<SessionData>
>({
  type: "multi",
  chat: {
    initial: () => ({}),
  },
  user: {
    getSessionKey: (ctx) => ctx.from?.id.toFixed(),
    initial: () => ({}),
  },
}));

bot.api.config.use(GrammyFiles.hydrateFiles(bot.token));

// Automatically cancel requests after 30 seconds
bot.api.config.use(async (prev, method, payload, signal) => {
  // don't time out getUpdates requests, they are long-polling
  if (method === "getUpdates") return prev(method, payload, signal);

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    // TODO: this sometimes throws with "can't abort a locked stream", why?
    try {
      controller.abort();
    } catch (error) {
      logger().error(`Error while cancelling on timeout: ${error}`);
    }
  }, 30 * 1000);
  signal?.addEventListener("abort", () => {
    controller.abort();
  });

  try {
    return await prev(method, payload, controller.signal);
  } finally {
    clearTimeout(timeout);
    if (timedOut) {
      logger().warning(`${method} timed out`);
    }
  }
});

// Automatically retry bot requests if we get a "too many requests" or telegram internal error
bot.api.config.use(async (prev, method, payload, signal) => {
  const maxAttempts = payload && ("maxAttempts" in payload) ? payload.maxAttempts ?? 3 : 3;
  let attempt = 0;
  while (true) {
    attempt++;
    const result = await prev(method, payload, signal);
    if (
      result.ok ||
      ![429, 500].includes(result.error_code) ||
      attempt >= maxAttempts
    ) {
      return result;
    }
    logger().warning(
      `${method} (attempt ${attempt}) failed: ${result.error_code} ${result.description}`,
    );
    const retryAfterMs = (result.parameters?.retry_after ?? (attempt * 5)) * 1000;
    await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
  }
});

bot.catch((err) => {
  logger().error(
    `Handling update from ${formatUserChat(err.ctx)} failed: ${err.name} ${err.message}`,
  );
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
  "I can generate furry images from text. " +
    "Send /txt2img to generate an image.",
);
bot.api.setMyCommands([
  { command: "txt2img", description: "Generate image from text" },
  { command: "img2img", description: "Generate image from image" },
  { command: "pnginfo", description: "Show generation parameters of an image" },
  { command: "queue", description: "Show the current queue" },
  { command: "cancel", description: "Cancel all your requests" },
]);

bot.command("start", (ctx) => ctx.reply("Hello! Use the /txt2img command to generate an image"));

bot.command("txt2img", txt2imgCommand);
bot.use(txt2imgQuestion.middleware());

bot.command("img2img", img2imgCommand);
bot.use(img2imgQuestion.middleware());

bot.command("pnginfo", pnginfoCommand);
bot.use(pnginfoQuestion.middleware());

bot.command("queue", queueCommand);

bot.command("cancel", cancelCommand);

bot.command("pause", async (ctx) => {
  if (!ctx.from?.username) return;
  const config = await getConfig();
  if (!config.adminUsernames.includes(ctx.from.username)) return;
  if (config.pausedReason != null) {
    return ctx.reply(`Already paused: ${config.pausedReason}`);
  }
  config.pausedReason = ctx.match ?? "No reason given";
  await setConfig(config);
  logger().warning(`Bot paused by ${ctx.from.first_name} because ${config.pausedReason}`);
  return ctx.reply("Paused");
});

bot.command("resume", async (ctx) => {
  if (!ctx.from?.username) return;
  const config = await getConfig();
  if (!config.adminUsernames.includes(ctx.from.username)) return;
  if (config.pausedReason == null) return ctx.reply("Already running");
  config.pausedReason = null;
  await setConfig(config);
  logger().info(`Bot resumed by ${ctx.from.first_name}`);
  return ctx.reply("Resumed");
});

bot.command("crash", () => {
  throw new Error("Crash command used");
});
