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
        if (!job.value.replyMessageId) continue;
        await bot.api.editMessageText(
          job.value.chat.id,
          job.value.replyMessageId,
          `You are ${formatOrdinal(index + 1)} in queue.`,
          { maxAttempts: 1 },
        ).catch(() => undefined);
      }
    } catch (err) {
      logger().warning(`Updating job status messages failed: ${err}`);
    }
  }
}
