import { Log } from "../deps.ts";
import { bot } from "../bot/mod.ts";
import { formatOrdinal } from "../utils.ts";
import { jobStore } from "../db/jobStore.ts";

const logger = () => Log.getLogger();

/**
 * Updates status messages for jobs in the queue.
 */
export async function updateJobStatusMsgs(): Promise<never> {
  while (true) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const jobs = await jobStore.getBy("status.type", "waiting");
      for (const [index, job] of jobs.entries()) {
        if (!job.value.reply) continue;
        await bot.api.editMessageText(
          job.value.reply.chat.id,
          job.value.reply.message_id,
          `You are ${formatOrdinal(index + 1)} in queue.`,
        ).catch(() => undefined);
      }
    } catch (err) {
      logger().warning(`Updating job status messages failed: ${err}`);
    }
  }
}