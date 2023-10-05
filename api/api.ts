import { Api } from "t_rest/server";
import { jobsRoute } from "./jobsRoute.ts";
import { sessionsRoute } from "./sessionsRoute.ts";
import { usersRoute } from "./usersRoute.ts";
import { paramsRoute } from "./paramsRoute.ts";

export const api = new Api({
  "jobs": jobsRoute,
  "sessions": sessionsRoute,
  "users": usersRoute,
  "settings/params": paramsRoute,
});

export type ErisApi = typeof api;
