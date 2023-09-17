import { Log } from "../deps.ts";
import { bot } from "../bot/mod.ts";
import { formatOrdinal } from "../common/utils.ts";
import { jobStore } from "../db/jobStore.ts";

const logger = () => Log.getLogger();

/**
 * Updates status messages for jobs in the queue.
 */
export async function updateJobStatusMsgs(): Promise<never> {
  while (true) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const jobs = await jobStore.getBy("status.type", { value: "waiting" });
      for (const [index, job] of jobs.entries()) {
        if (job.value.status.type !== "waiting" || !job.value.status.message) continue;
        await bot.api.editMessageText(
          job.value.status.message.chat.id,
          job.value.status.message.message_id,
          `You are ${formatOrdinal(index + 1)} in queue.`,
          { maxAttempts: 1 },
        ).catch(() => undefined);
      }
    } catch (err) {
      logger().warning(`Updating job status messages failed: ${err}`);
    }
  }
}
