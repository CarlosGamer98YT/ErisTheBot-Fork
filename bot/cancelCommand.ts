import { jobStore } from "../db/jobStore.ts";
import { Context } from "./mod.ts";

export async function cancelCommand(ctx: Context) {
  const jobs = await jobStore.getBy("status.type", { value: "waiting" });
  const userJobs = jobs.filter((j) => j.value.from.id === ctx.from?.id);
  for (const job of userJobs) await job.delete();
  await ctx.reply(`Cancelled ${userJobs.length} jobs`);
}
