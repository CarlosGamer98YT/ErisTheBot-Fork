import { Async, Log } from "../deps.ts";
import { getGlobalSession } from "../bot/session.ts";
import { sdGetConfig } from "../common/sdApi.ts";

const logger = () => Log.getLogger();

export const runningWorkers = new Set<string>();

/**
 * Periodically ping the workers to see if they are alive.
 */
export async function pingWorkers(): Promise<never> {
  while (true) {
    try {
      const config = await getGlobalSession();
      for (const worker of config.workers) {
        const status = await sdGetConfig(worker.api).catch(() => null);
        const wasRunning = runningWorkers.has(worker.id);
        if (status) {
          runningWorkers.add(worker.id);
          if (!wasRunning) logger().info(`Worker ${worker.id} is online`);
        } else {
          runningWorkers.delete(worker.id);
          if (wasRunning) logger().warning(`Worker ${worker.id} went offline`);
        }
      }
      await Async.delay(60 * 1000);
    } catch (err) {
      logger().warning(`Pinging workers failed: ${err}`);
    }
  }
}
