import { createEndpoint, createMethodFilter } from "t_rest/server";
import { generationQueue } from "../app/generationQueue.ts";

export const jobsRoute = createMethodFilter({
  GET: createEndpoint(
    { query: null, body: null },
    async () => ({
      status: 200,
      body: {
        type: "application/json",
        data: await generationQueue.getAllJobs(),
      },
    }),
  ),
});
