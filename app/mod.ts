import { processGenerationQueue, updateGenerationQueue } from "./generationQueue.ts";
import { processUploadQueue } from "./uploadQueue.ts";

export async function runAllTasks() {
  await Promise.all([
    processGenerationQueue(),
    updateGenerationQueue(),
    processUploadQueue(),
  ]);
}
