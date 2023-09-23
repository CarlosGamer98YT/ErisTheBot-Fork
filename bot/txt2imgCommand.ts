import { Grammy, GrammyStatelessQ } from "../deps.ts";
import { formatUserChat } from "../utils/formatUserChat.ts";
import { getPngInfo, parsePngInfo, PngInfo } from "../sd/parsePngInfo.ts";
import { Context, logger } from "./mod.ts";
import { generationQueue } from "../app/generationQueue.ts";
import { getConfig } from "../app/config.ts";

export const txt2imgQuestion = new GrammyStatelessQ.StatelessQuestion<Context>(
  "txt2img",
  async (ctx) => {
    if (!ctx.message.text) return;
    await txt2img(ctx, ctx.message.text, false);
  },
);

export async function txt2imgCommand(ctx: Grammy.CommandContext<Context>) {
  await txt2img(ctx, ctx.match, true);
}

async function txt2img(ctx: Context, match: string, includeRepliedTo: boolean): Promise<void> {
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

  if (includeRepliedTo && repliedToMsg?.document?.mime_type === "image/png") {
    const file = await ctx.api.getFile(repliedToMsg.document.file_id);
    const buffer = await fetch(file.getUrl()).then((resp) => resp.arrayBuffer());
    params = parsePngInfo(getPngInfo(new Uint8Array(buffer)) ?? "", params);
  }

  const repliedToText = repliedToMsg?.text || repliedToMsg?.caption;
  if (includeRepliedTo && repliedToText) {
    // TODO: remove bot command from replied to text
    params = parsePngInfo(repliedToText, params);
  }

  params = parsePngInfo(match, params);

  if (!params.prompt) {
    await ctx.reply(
      "Please tell me what you want to see." +
        txt2imgQuestion.messageSuffixMarkdown(),
      { reply_markup: { force_reply: true, selective: true }, parse_mode: "Markdown" },
    );
    return;
  }

  const replyMessage = await ctx.reply("Accepted. You are now in queue.");

  await generationQueue.pushJob({
    task: { type: "txt2img", params },
    from: ctx.message.from,
    chat: ctx.message.chat,
    requestMessage: ctx.message,
    replyMessage: replyMessage,
  });

  logger().debug(`Job enqueued for ${formatUserChat(ctx.message)}`);
}
