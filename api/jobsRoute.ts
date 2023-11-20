import { Elysia, t } from "elysia";
import { generationQueue } from "../app/generationQueue.ts";

export const jobsRoute = new Elysia()
  .get(
    "",
    async () => {
      const allJobs = await generationQueue.getAllJobs();
      return allJobs.map((job) => ({
        id: job.id.join(":"),
        place: job.place,
        state: {
          from: {
            language_code: job.state.from.language_code ?? null,
            first_name: job.state.from.first_name,
            last_name: job.state.from.last_name ?? null,
            username: job.state.from.username ?? null,
          },
          progress: job.state.progress ?? null,
          workerInstanceKey: job.state.workerInstanceKey ?? null,
        },
      }));
    },
    {
      response: t.Array(t.Object({
        id: t.String(),
        place: t.Number(),
        state: t.Object({
          from: t.Object({
            language_code: t.Nullable(t.String()),
            first_name: t.String(),
            last_name: t.Nullable(t.String()),
            username: t.Nullable(t.String()),
          }),
          progress: t.Nullable(t.Number()),
          workerInstanceKey: t.Nullable(t.String()),
        }),
      })),
    },
  );
