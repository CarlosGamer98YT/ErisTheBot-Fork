import { generationQueue } from "../tasks/generationQueue.ts";
import { Context } from "./mod.ts";

export async function cancelCommand(ctx: Context) {
  const jobs = await generationQueue.getAllJobs();
  const userJobs = jobs
    .filter((job) => job.lockUntil > new Date())
    .filter((j) => j.state.from.id === ctx.from?.id);
  for (const job of userJobs) await generationQueue.deleteJob(job.id);
  await ctx.reply(`Cancelled ${userJobs.length} jobs`);
}
