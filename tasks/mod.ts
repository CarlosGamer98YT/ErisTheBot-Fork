import { handleGenerationUpdates, restartGenerationWorkers } from "./generationQueue.ts";

export async function runAllTasks() {
  await Promise.all([
    restartGenerationWorkers(),
    handleGenerationUpdates(),
  ]);
}
