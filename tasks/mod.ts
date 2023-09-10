import { pingWorkers } from "./pingWorkers.ts";
import { processJobs } from "./processJobs.ts";
import { returnHangedJobs } from "./returnHangedJobs.ts";
import { updateJobStatusMsgs } from "./updateJobStatusMsgs.ts";

export async function runAllTasks() {
  await Promise.all([
    processJobs(),
    updateJobStatusMsgs(),
    returnHangedJobs(),
    pingWorkers(),
  ]);
}
