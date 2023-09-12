import { Grammy, GrammyStatelessQ } from "../deps.ts";
import { formatUserChat } from "../utils.ts";
import { jobStore } from "../db/jobStore.ts";
import { getPngInfo, parsePngInfo, PngInfo } from "../sd.ts";
import { Context, logger } from "./mod.ts";

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

  if (ctx.session.global.pausedReason != null) {
    await ctx.reply(`I'm paused: ${ctx.session.global.pausedReason || "No reason given"}`);
    return;
  }

  const jobs = await jobStore.getBy("status.type", "waiting");
  if (jobs.length >= ctx.session.global.maxJobs) {
    await ctx.reply(
      `The queue is full. Try again later. (Max queue size: ${ctx.session.global.maxJobs})`,
    );
    return;
  }

  const userJobs = jobs.filter((job) => job.value.from.id === ctx.message?.from?.id);
  if (userJobs.length >= ctx.session.global.maxUserJobs) {
    await ctx.reply(
      `You already have ${ctx.session.global.maxUserJobs} jobs in queue. Try again later.`,
    );
    return;
  }

  let params: Partial<PngInfo> = {};

  const repliedToMsg = ctx.message.reply_to_message;

  if (includeRepliedTo && repliedToMsg?.document?.mime_type === "image/png") {
    const file = await ctx.api.getFile(repliedToMsg.document.file_id);
    const buffer = await fetch(file.getUrl()).then((resp) => resp.arrayBuffer());
    const fileParams = parsePngInfo(getPngInfo(new Uint8Array(buffer)) ?? "");
    params = {
      ...params,
      ...fileParams,
      prompt: [params.prompt, fileParams.prompt].filter(Boolean).join("\n"),
      negative_prompt: [params.negative_prompt, fileParams.negative_prompt]
        .filter(Boolean).join("\n"),
    };
  }

  const repliedToText = repliedToMsg?.text || repliedToMsg?.caption;
  if (includeRepliedTo && repliedToText) {
    // TODO: remove bot command from replied to text
    const originalParams = parsePngInfo(repliedToText);
    params = {
      ...originalParams,
      ...params,
      prompt: [originalParams.prompt, params.prompt].filter(Boolean).join("\n"),
      negative_prompt: [originalParams.negative_prompt, params.negative_prompt]
        .filter(Boolean).join("\n"),
    };
  }

  const messageParams = parsePngInfo(match);
  params = {
    ...params,
    ...messageParams,
    prompt: [params.prompt, messageParams.prompt].filter(Boolean).join("\n"),
  };

  if (!params.prompt) {
    await ctx.reply(
      "Please tell me what you want to see." +
        txt2imgQuestion.messageSuffixMarkdown(),
      { reply_markup: { force_reply: true, selective: true }, parse_mode: "Markdown" },
    );
    return;
  }

  const replyMessage = await ctx.reply("Accepted. You are now in queue.");

  await jobStore.create({
    task: { type: "txt2img", params },
    from: ctx.message.from,
    chat: ctx.message.chat,
    requestMessageId: ctx.message.message_id,
    status: { type: "waiting", message: replyMessage },
  });

  logger().debug(`Job enqueued for ${formatUserChat(ctx.message)}`);
}
