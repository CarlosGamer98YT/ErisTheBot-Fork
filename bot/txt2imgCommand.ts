import { CommandContext } from "grammy";
import { StatelessQuestion } from "grammy_stateless_question";
import { debug } from "std/log/mod.ts";
import { getConfig } from "../app/config.ts";
import { generationQueue } from "../app/generationQueue.ts";
import { formatUserChat } from "../utils/formatUserChat.ts";
import { ErisContext } from "./mod.ts";
import { getPngInfo, parsePngInfo, PngInfo } from "./parsePngInfo.ts";

export const txt2imgQuestion = new StatelessQuestion<ErisContext>(
  "txt2img",
  async (ctx) => {
    if (!ctx.message.text) return;
    await txt2img(ctx, ctx.message.text, false);
  },
);

export async function txt2imgCommand(ctx: CommandContext<ErisContext>) {
  await txt2img(ctx, ctx.match, true);
}

async function txt2img(ctx: ErisContext, match: string, includeRepliedTo: boolean): Promise<void> {
  if (!ctx.from || !ctx.message) {
    return;
  }

  if (ctx.from.is_bot) {
    return;
  }

  const config = await getConfig();

  if (config.pausedReason != null) {
    await ctx.reply(`I'm paused: ${config.pausedReason || "No reason given"}`, {
      reply_to_message_id: ctx.message?.message_id,
    });
    return;
  }

  const jobs = await generationQueue.getAllJobs();
  if (jobs.length >= config.maxJobs) {
    await ctx.reply(`The queue is full. Try again later. (Max queue size: ${config.maxJobs})`, {
      reply_to_message_id: ctx.message?.message_id,
    });
    return;
  }

  const userJobs = jobs.filter((job) => job.state.from.id === ctx.message?.from?.id);
  if (userJobs.length >= config.maxUserJobs) {
    await ctx.reply(`You already have ${userJobs.length} jobs in queue. Try again later.`, {
      reply_to_message_id: ctx.message?.message_id,
    });
    return;
  }

  let params: Partial<PngInfo> = {};

  const repliedToMsg = ctx.message.reply_to_message;

  if (includeRepliedTo && repliedToMsg?.document?.mime_type === "image/png") {
    const file = await ctx.api.getFile(repliedToMsg.document.file_id);
    const buffer = await fetch(file.getUrl()).then((resp) => resp.arrayBuffer());
    params = parsePngInfo(getPngInfo(new Uint8Array(buffer)) ?? "", params);
  }

  const repliedToText = repliedToMsg?.text || repliedToMsg?.caption;
  const isReply = includeRepliedTo && repliedToText;

  if (isReply) {
    // TODO: remove bot command from replied to text
    params = parsePngInfo(repliedToText, params);
  }

  params = parsePngInfo(match, params, true);

  if (isReply) {
    const parsedInfo = parsePngInfo(repliedToText, undefined, true);
    if (parsedInfo.prompt !== params.prompt) {
      params.seed = parsedInfo.seed ?? -1;
    }
  }

  if (!params.prompt) {
    await ctx.reply(
      "Please tell me what you want to see." +
        txt2imgQuestion.messageSuffixMarkdown(),
      {
        reply_markup: { force_reply: true, selective: true },
        parse_mode: "Markdown",
        reply_to_message_id: ctx.message?.message_id,
      },
    );
    return;
  }

  const replyMessage = await ctx.reply("Accepted. You are now in queue.", {
    reply_to_message_id: ctx.message?.message_id,
  });

  await generationQueue.pushJob({
    task: { type: "txt2img", params },
    from: ctx.message.from,
    chat: ctx.message.chat,
    requestMessage: ctx.message,
    replyMessage: replyMessage,
  }, { retryCount: 3, retryDelayMs: 10_000 });

  debug(`Generation (txt2img) enqueued for ${formatUserChat(ctx.message)}`);
}
