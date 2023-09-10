import { Grammy, GrammyAutoQuote, GrammyParseMode, Log } from "../deps.ts";
import { formatUserChat } from "../utils.ts";
import { session, SessionFlavor } from "./session.ts";
import { queueCommand } from "./queueCommand.ts";
import { txt2imgCommand } from "./txt2imgCommand.ts";

export const logger = () => Log.getLogger();

export type Context = GrammyParseMode.ParseModeFlavor<Grammy.Context> & SessionFlavor;
export const bot = new Grammy.Bot<Context>(Deno.env.get("TG_BOT_TOKEN") ?? "");
bot.use(GrammyAutoQuote.autoQuote);
bot.use(GrammyParseMode.hydrateReply);
bot.use(session);

bot.catch((err) => {
  logger().error(`Handling update from ${formatUserChat(err.ctx)} failed: ${err}`);
});

// Automatically retry bot requests if we get a "too many requests" or telegram internal error
bot.api.config.use(async (prev, method, payload, signal) => {
  let attempt = 0;
  while (true) {
    attempt++;
    const result = await prev(method, payload, signal);
    if (
      result.ok ||
      ![429, 500].includes(result.error_code) ||
      attempt >= 5
    ) {
      return result;
    }
    const retryAfterMs = (result.parameters?.retry_after ?? (attempt * 5)) * 1000;
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
  "I can generate furry images from text. " +
    "Send /txt2img to generate an image.",
);
bot.api.setMyCommands([
  { command: "txt2img", description: "Generate an image" },
  { command: "queue", description: "Show the current queue" },
]);

bot.command("start", (ctx) => ctx.reply("Hello! Use the /txt2img command to generate an image"));

bot.command("txt2img", txt2imgCommand);

bot.command("queue", queueCommand);

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