import { FmtDuration, Log } from "../deps.ts";
import { formatUserChat } from "../common/utils.ts";
import { jobStore } from "../db/jobStore.ts";

const logger = () => Log.getLogger();

/**
 * Returns hanged jobs to the queue.
 */
export async function returnHangedJobs(): Promise<never> {
  while (true) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const jobs = await jobStore.getBy("status.type", "processing");
      for (const job of jobs) {
        if (job.value.status.type !== "processing") continue;
        // if job wasn't updated for 2 minutes, return it to the queue
        const timeSinceLastUpdateMs = Date.now() - job.value.status.updatedDate.getTime();
        if (timeSinceLastUpdateMs > 2 * 60 * 1000) {
          await job.update((value) => ({
            ...value,
            status: {
              type: "waiting",
              message: value.status.type !== "done" ? value.status.message : undefined,
            },
          }));
          logger().warning(
            `Job for ${formatUserChat(job.value)} was returned to the queue because it hanged for ${
              FmtDuration.format(Math.trunc(timeSinceLastUpdateMs / 1000) * 1000, {
                ignoreZero: true,
              })
            }`,
          );
        }
      }
    } catch (err) {
      logger().warning(`Returning hanged jobs failed: ${err}`);
    }
  }
}
