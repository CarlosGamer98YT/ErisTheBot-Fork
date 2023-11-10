import { createEndpoint, createMethodFilter } from "t_rest/server";
import { generationQueue } from "../app/generationQueue.ts";

export const jobsRoute = createMethodFilter({
  GET: createEndpoint(
    { query: null, body: null },
    async () => {
      const allJobs = await generationQueue.getAllJobs();
      const filteredJobsData = allJobs.map((job) => ({
        id: job.id,
        place: job.place,
        state: {
          from: {
            language_code: job.state.from.language_code,
            first_name: job.state.from.first_name,
            last_name: job.state.from.last_name,
            username: job.state.from.username,
          },
          progress: job.state.progress,
          workerInstanceKey: job.state.workerInstanceKey,
        },
      }));
      return {
        status: 200,
        body: {
          type: "application/json",
          data: filteredJobsData,
        },
      };
    },
  ),
});
