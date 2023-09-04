import {
  autoQuote,
  autoRetry,
  bold,
  Bot,
  Context,
  fmt,
  hydrateReply,
  ParseModeFlavor,
} from "./deps.ts";
import { fmtArray, formatOrdinal } from "./intl.ts";
import { config } from "./config.ts";
import { queue } from "./queue.ts";

export const bot = new Bot<ParseModeFlavor<Context>>(Deno.env.get("TG_BOT_TOKEN") ?? "");
bot.use(autoQuote);
bot.use(hydrateReply);
bot.api.config.use(autoRetry({ maxRetryAttempts: 5, maxDelaySeconds: 60 }));

bot.api.setMyShortDescription("I can generate furry images from text");
bot.api.setMyDescription(
  "I can generate furry images from text. Send /txt2img to generate an image.",
);
bot.api.setMyCommands([
  { command: "txt2img", description: "Generate an image" },
  { command: "queue", description: "Show the current queue" },
]);

bot.command("start", (ctx) => ctx.reply("Hello! Use the /txt2img command to generate an image"));

bot.command("txt2img", async (ctx) => {
  if (!ctx.from?.id) {
    return ctx.reply("I don't know who you are");
  }
  if (config.pausedReason != null) {
    return ctx.reply(`I'm paused: ${config.pausedReason}`);
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

bot.command("queue", async (ctx) => {
  if (queue.length === 0) return ctx.reply("Queue is empty");
  return await ctx.replyFmt(
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

bot.command("pause", async (ctx) => {
  if (!ctx.from?.username) return;
  if (!config.adminUsernames.includes(ctx.from.username)) return;
  if (config.pausedReason != null) {
    return await ctx.reply(`Already paused: ${config.pausedReason}`);
  }
  config.pausedReason = ctx.match ?? "No reason given";
  return await ctx.reply("Paused");
});

bot.command("resume", async (ctx) => {
  if (!ctx.from?.username) return;
  if (!config.adminUsernames.includes(ctx.from.username)) return;
  if (config.pausedReason == null) return await ctx.reply("Already running");
  config.pausedReason = null;
  return await ctx.reply("Resumed");
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
