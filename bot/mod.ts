import { Grammy, GrammyAutoQuote, GrammyFiles, GrammyParseMode, Log } from "../deps.ts";
import { formatUserChat } from "../common/utils.ts";
import { session, SessionFlavor } from "./session.ts";
import { queueCommand } from "./queueCommand.ts";
import { txt2imgCommand, txt2imgQuestion } from "./txt2imgCommand.ts";
import { pnginfoCommand, pnginfoQuestion } from "./pnginfoCommand.ts";
import { img2imgCommand, img2imgQuestion } from "./img2imgCommand.ts";
import { cancelCommand } from "./cancelCommand.ts";

export const logger = () => Log.getLogger();

type WithRetryApi<T extends Grammy.RawApi> = {
  [M in keyof T]: T[M] extends (args: infer P, ...rest: infer A) => infer R
    ? (args: P extends object ? P & { maxAttempts?: number } : P, ...rest: A) => R
    : T[M];
};

export type Context =
  & GrammyFiles.FileFlavor<GrammyParseMode.ParseModeFlavor<Grammy.Context>>
  & SessionFlavor;
export const bot = new Grammy.Bot<Context, Grammy.Api<WithRetryApi<Grammy.RawApi>>>(
  Deno.env.get("TG_BOT_TOKEN") ?? "",
);
bot.use(GrammyAutoQuote.autoQuote);
bot.use(GrammyParseMode.hydrateReply);
bot.use(session);

bot.api.config.use(GrammyFiles.hydrateFiles(bot.token));

// Automatically cancel requests after 30 seconds
bot.api.config.use(async (prev, method, payload, signal) => {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    // TODO: this sometimes throws with "can't abort a locked stream" and crashes whole process
    controller.abort();
  }, 30 * 1000);
  signal?.addEventListener("abort", () => {
    controller.abort();
  });
  try {
    const result = await prev(method, payload, controller.signal);
    return result;
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

bot.command("pause", (ctx) => {
  if (!ctx.from?.username) return;
  const config = ctx.session.global;
  if (!config.adminUsernames.includes(ctx.from.username)) return;
  if (config.pausedReason != null) {
    return ctx.reply(`Already paused: ${config.pausedReason}`);
  }
  config.pausedReason = ctx.match ?? "No reason given";
  logger().warning(`Bot paused by ${ctx.from.first_name} because ${config.pausedReason}`);
  return ctx.reply("Paused");
});

bot.command("resume", (ctx) => {
  if (!ctx.from?.username) return;
  const config = ctx.session.global;
  if (!config.adminUsernames.includes(ctx.from.username)) return;
  if (config.pausedReason == null) return ctx.reply("Already running");
  config.pausedReason = null;
  logger().info(`Bot resumed by ${ctx.from.first_name}`);
  return ctx.reply("Resumed");
});

bot.command("crash", () => {
  throw new Error("Crash command used");
});
