import { Grammy } from "../deps.ts";
import { formatUserChat } from "../utils.ts";
import { jobStore } from "../db/jobStore.ts";
import { parsePngInfo } from "../sd.ts";
import { Context, logger } from "./mod.ts";

export async function txt2imgCommand(ctx: Grammy.CommandContext<Context>) {
  if (!ctx.from?.id) {
    return ctx.reply("I don't know who you are");
  }
  const config = ctx.session.global;
  if (config.pausedReason != null) {
    return ctx.reply(`I'm paused: ${config.pausedReason || "No reason given"}`);
  }
  const jobs = await jobStore.getBy("status.type", "waiting");
  if (jobs.length >= config.maxJobs) {
    return ctx.reply(
      `The queue is full. Try again later. (Max queue size: ${config.maxJobs})`,
    );
  }
  const userJobs = jobs.filter((job) => job.value.request.from.id === ctx.from?.id);
  if (userJobs.length >= config.maxUserJobs) {
    return ctx.reply(
      `You already have ${config.maxUserJobs} jobs in queue. Try again later.`,
    );
  }
  const params = parsePngInfo(ctx.match);
  if (!params.prompt) {
    return ctx.reply("Please describe what you want to see after the command");
  }
  const reply = await ctx.reply("Accepted. You are now in queue.");
  await jobStore.create({
    params,
    request: ctx.message,
    reply,
    status: { type: "waiting" },
  });
  logger().debug(`Job enqueued for ${formatUserChat(ctx)}`);
}
