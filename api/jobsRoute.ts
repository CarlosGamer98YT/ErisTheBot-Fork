import { Endpoint, Route } from "t_rest/server";
import { generationQueue } from "../app/generationQueue.ts";

export const jobsRoute = {
  GET: new Endpoint(
    { query: null, body: null },
    async () => ({
      status: 200,
      type: "application/json",
      body: await generationQueue.getAllJobs(),
    }),
  ),
} satisfies Route;
