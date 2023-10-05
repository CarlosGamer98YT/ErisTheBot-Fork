import { generationQueue } from "../app/generationQueue.ts";
import { ErisContext } from "./mod.ts";

export async function cancelCommand(ctx: ErisContext) {
  const jobs = await generationQueue.getAllJobs();
  const userJobs = jobs
    .filter((job) => job.lockUntil < new Date())
    .filter((j) => j.state.from.id === ctx.from?.id);
  for (const job of userJobs) await generationQueue.deleteJob(job.id);
  await ctx.reply(`Cancelled ${userJobs.length} jobs`, {
    reply_to_message_id: ctx.message?.message_id,
    allow_sending_without_reply: true,
  });
}
