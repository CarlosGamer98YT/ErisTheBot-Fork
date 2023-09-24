import { CommandContext } from "grammy";
import { StatelessQuestion } from "grammy_stateless_question";
import { maxBy } from "std/collections";
import { getConfig } from "../app/config.ts";
import { generationQueue } from "../app/generationQueue.ts";
import { parsePngInfo, PngInfo } from "../sd/parsePngInfo.ts";
import { formatUserChat } from "../utils/formatUserChat.ts";
import { ErisContext, logger } from "./mod.ts";

export const img2imgQuestion = new StatelessQuestion<ErisContext>(
  "img2img",
  async (ctx, state) => {
    // todo: also save original image size in state
    await img2img(ctx, ctx.message.text, false, state);
  },
);

export async function img2imgCommand(ctx: CommandContext<ErisContext>) {
  await img2img(ctx, ctx.match, true);
}

async function img2img(
  ctx: ErisContext,
  match: string | undefined,
  includeRepliedTo: boolean,
  fileId?: string,
): Promise<void> {
  if (!ctx.message?.from?.id) {
    await ctx.reply("I don't know who you are");
    return;
  }

  const config = await getConfig();

  if (config.pausedReason != null) {
    await ctx.reply(`I'm paused: ${config.pausedReason || "No reason given"}`);
    return;
  }

  const jobs = await generationQueue.getAllJobs();
  if (jobs.length >= config.maxJobs) {
    await ctx.reply(
      `The queue is full. Try again later. (Max queue size: ${config.maxJobs})`,
    );
    return;
  }

  const userJobs = jobs.filter((job) => job.state.from.id === ctx.message?.from?.id);
  if (userJobs.length >= config.maxUserJobs) {
    await ctx.reply(
      `You already have ${config.maxUserJobs} jobs in queue. Try again later.`,
    );
    return;
  }

  let params: Partial<PngInfo> = {};

  const repliedToMsg = ctx.message.reply_to_message;

  if (includeRepliedTo && repliedToMsg?.photo) {
    const photos = repliedToMsg.photo;
    const biggestPhoto = maxBy(photos, (p) => p.width * p.height);
    if (!biggestPhoto) throw new Error("Message was a photo but had no photos?");
    fileId = biggestPhoto.file_id;
    params.width = biggestPhoto.width;
    params.height = biggestPhoto.height;
  }

  if (ctx.message.photo) {
    const photos = ctx.message.photo;
    const biggestPhoto = maxBy(photos, (p) => p.width * p.height);
    if (!biggestPhoto) throw new Error("Message was a photo but had no photos?");
    fileId = biggestPhoto.file_id;
    params.width = biggestPhoto.width;
    params.height = biggestPhoto.height;
  }

  const repliedToText = repliedToMsg?.text || repliedToMsg?.caption;
  if (includeRepliedTo && repliedToText) {
    // TODO: remove bot command from replied to text
    params = parsePngInfo(repliedToText, params);
  }

  params = parsePngInfo(match ?? "", params);

  if (!fileId) {
    await ctx.reply(
      "Please show me a picture to repaint." +
        img2imgQuestion.messageSuffixMarkdown(),
      { reply_markup: { force_reply: true, selective: true }, parse_mode: "Markdown" },
    );
    return;
  }

  if (!params.prompt) {
    await ctx.reply(
      "Please describe the picture you want to repaint." +
        img2imgQuestion.messageSuffixMarkdown(fileId),
      { reply_markup: { force_reply: true, selective: true }, parse_mode: "Markdown" },
    );
    return;
  }

  const replyMessage = await ctx.reply("Accepted. You are now in queue.");

  await generationQueue.pushJob({
    task: { type: "img2img", params, fileId },
    from: ctx.message.from,
    chat: ctx.message.chat,
    requestMessage: ctx.message,
    replyMessage: replyMessage,
  }, { retryCount: 3, repeatDelayMs: 10_000 });

  logger().debug(`Generation (img2img) enqueued for ${formatUserChat(ctx.message)}`);
}
