import {
  createEndpoint,
  createLoggerMiddleware,
  createMethodFilter,
  createPathFilter,
} from "t_rest/server";
import { jobsRoute } from "./jobsRoute.ts";
import { paramsRoute } from "./paramsRoute.ts";
import { sessionsRoute } from "./sessionsRoute.ts";
import { statsRoute } from "./statsRoute.ts";
import { usersRoute } from "./usersRoute.ts";
import { workersRoute } from "./workersRoute.ts";
import { bot } from "../bot/mod.ts";

export const serveApi = createLoggerMiddleware(
  createPathFilter({
    "jobs": jobsRoute,
    "sessions": sessionsRoute,
    "users": usersRoute,
    "settings/params": paramsRoute,
    "stats": statsRoute,
    "workers": workersRoute,
    "bot": createMethodFilter({
      // deno-lint-ignore require-await
      GET: createEndpoint({ query: null, body: null }, async () => {
        const username = bot.botInfo.username;
        return { status: 200, body: { type: "application/json", data: { username } } };
      }),
    }),
  }),
  { filterStatus: (status) => status >= 400 },
);

export type ApiHandler = typeof serveApi;
