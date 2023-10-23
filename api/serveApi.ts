import { createLoggerMiddleware, createPathFilter } from "t_rest/server";
import { adminsRoute } from "./adminsRoute.ts";
import { botRoute } from "./botRoute.ts";
import { jobsRoute } from "./jobsRoute.ts";
import { paramsRoute } from "./paramsRoute.ts";
import { sessionsRoute } from "./sessionsRoute.ts";
import { statsRoute } from "./statsRoute.ts";
import { usersRoute } from "./usersRoute.ts";
import { workersRoute } from "./workersRoute.ts";

export const serveApi = createLoggerMiddleware(
  createPathFilter({
    "admins": adminsRoute,
    "bot": botRoute,
    "jobs": jobsRoute,
    "sessions": sessionsRoute,
    "settings/params": paramsRoute,
    "stats": statsRoute,
    "users": usersRoute,
    "workers": workersRoute,
  }),
  { filterStatus: (status) => status >= 400 },
);

export type ApiHandler = typeof serveApi;
