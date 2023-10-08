import { createPathFilter } from "t_rest/server";
import { jobsRoute } from "./jobsRoute.ts";
import { sessionsRoute } from "./sessionsRoute.ts";
import { usersRoute } from "./usersRoute.ts";
import { paramsRoute } from "./paramsRoute.ts";

export const serveApi = createPathFilter({
  "jobs": jobsRoute,
  "sessions": sessionsRoute,
  "users": usersRoute,
  "settings/params": paramsRoute,
});

export type ApiHandler = typeof serveApi;
