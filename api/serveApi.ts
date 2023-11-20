import { Elysia } from "elysia";
import { swagger } from "elysia/swagger";
import { adminsRoute } from "./adminsRoute.ts";
import { botRoute } from "./botRoute.ts";
import { jobsRoute } from "./jobsRoute.ts";
import { paramsRoute } from "./paramsRoute.ts";
import { sessionsRoute } from "./sessionsRoute.ts";
import { statsRoute } from "./statsRoute.ts";
import { usersRoute } from "./usersRoute.ts";
import { workersRoute } from "./workersRoute.ts";

export const api = new Elysia()
  .use(
    swagger({
      path: "/docs",
      swaggerOptions: { url: "docs/json" } as never,
      documentation: {
        info: { title: "Eris API", version: "0.1" },
        servers: [{ url: "/api" }],
      },
    }),
  )
  .group("/admins", (api) => api.use(adminsRoute))
  .group("/bot", (api) => api.use(botRoute))
  .group("/jobs", (api) => api.use(jobsRoute))
  .group("/sessions", (api) => api.use(sessionsRoute))
  .group("/settings/params", (api) => api.use(paramsRoute))
  .group("/stats", (api) => api.use(statsRoute))
  .group("/users", (api) => api.use(usersRoute))
  .group("/workers", (api) => api.use(workersRoute));

export type Api = typeof api;
