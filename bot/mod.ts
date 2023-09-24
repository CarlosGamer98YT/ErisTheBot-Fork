import { Api, Bot, Context, RawApi, session, SessionFlavor } from "grammy";
import { autoQuote } from "grammy_autoquote";
import { FileFlavor, hydrateFiles } from "grammy_files";
import { hydrateReply, ParseModeFlavor } from "grammy_parse_mode";
import { getLogger } from "std/log";
import { getConfig, setConfig } from "../app/config.ts";
import { formatUserChat } from "../utils/formatUserChat.ts";
import { cancelCommand } from "./cancelCommand.ts";
import { img2imgCommand, img2imgQuestion } from "./img2imgCommand.ts";
import { pnginfoCommand, pnginfoQuestion } from "./pnginfoCommand.ts";
import { queueCommand } from "./queueCommand.ts";
import { txt2imgCommand, txt2imgQuestion } from "./txt2imgCommand.ts";

export const logger = () => getLogger();

interface SessionData {
  chat: ErisChatData;
  user: ErisUserData;
}

interface ErisChatData {
  language?: string;
}

interface ErisUserData {
  params?: Record<string, string>;
}

export type ErisContext =
  & FileFlavor<ParseModeFlavor<Context>>
  & SessionFlavor<SessionData>;

type WithRetryApi<T extends RawApi> = {
  [M in keyof T]: T[M] extends (args: infer P, ...rest: infer A) => infer R
    ? (args: P extends object ? P & { maxAttempts?: number; maxWait?: number } : P, ...rest: A) => R
    : T[M];
};

type ErisApi = Api<WithRetryApi<RawApi>>;

export const bot = new Bot<ErisContext, ErisApi>(
  Deno.env.get("TG_BOT_TOKEN")!,
  {
    client: { timeoutSeconds: 20 },
  },
);

bot.use(autoQuote);
bot.use(hydrateReply);
bot.use(session<SessionData, ErisContext>({
  type: "multi",
  chat: {
    initial: () => ({}),
  },
  user: {
    getSessionKey: (ctx) => ctx.from?.id.toFixed(),
    initial: () => ({}),
  },
}));

bot.api.config.use(hydrateFiles(bot.token));

// Automatically retry bot requests if we get a "too many requests" or telegram internal error
bot.api.config.use(async (prev, method, payload, signal) => {
  const maxAttempts = payload && ("maxAttempts" in payload) ? payload.maxAttempts ?? 3 : 3;
  const maxWait = payload && ("maxWait" in payload) ? payload.maxWait ?? 10 : 10;
  let attempt = 0;
  while (true) {
    attempt++;
    const result = await prev(method, payload, signal);
    if (result.ok) return result;
    if (result.error_code !== 429) return result;
    if (attempt >= maxAttempts) return result;
    const retryAfter = result.parameters?.retry_after ?? (attempt * 5);
    if (retryAfter > maxWait) return result;
    logger().warning(
      `${method} (attempt ${attempt}) failed: ${result.error_code} ${result.description}`,
    );
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
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
