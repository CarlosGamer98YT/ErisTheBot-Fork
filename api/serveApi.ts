import { createLoggerMiddleware, createPathFilter } from "t_rest/server";
import { jobsRoute } from "./jobsRoute.ts";
import { paramsRoute } from "./paramsRoute.ts";
import { sessionsRoute } from "./sessionsRoute.ts";
import { statsRoute } from "./statsRoute.ts";
import { usersRoute } from "./usersRoute.ts";

export const serveApi = createLoggerMiddleware(
  createPathFilter({
    "jobs": jobsRoute,
    "sessions": sessionsRoute,
    "users": usersRoute,
    "settings/params": paramsRoute,
    "stats": statsRoute,
  }),
  { filterStatus: (status) => status >= 400 },
);

export type ApiHandler = typeof serveApi;
