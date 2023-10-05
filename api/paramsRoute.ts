import { deepMerge } from "std/collections/deep_merge.ts";
import { getLogger } from "std/log/mod.ts";
import { Endpoint, Route } from "t_rest/server";
import { configSchema, getConfig, setConfig } from "../app/config.ts";
import { bot } from "../bot/mod.ts";
import { sessions } from "./sessionsRoute.ts";

export const logger = () => getLogger();

export const paramsRoute = {
  GET: new Endpoint(
    { query: null, body: null },
    async () => {
      const config = await getConfig();
      return {
        status: 200,
        type: "application/json",
        body: config?.defaultParams,
      };
    },
  ),

  PATCH: new Endpoint(
    {
      query: { sessionId: { type: "string" } },
      body: {
        type: "application/json",
        schema: configSchema.properties.defaultParams,
      },
    },
    async ({ query, body }) => {
      const session = sessions.get(query.sessionId);
      if (!session?.userId) {
        return { status: 401, type: "text/plain", body: "Must be logged in" };
      }
      const chat = await bot.api.getChat(session.userId);
      if (chat.type !== "private") {
        throw new Error("Chat is not private");
      }
      const userName = chat.username;
      if (!userName) {
        return { status: 403, type: "text/plain", body: "Must have a username" };
      }
      const config = await getConfig();
      if (!config?.adminUsernames?.includes(userName)) {
        return { status: 403, type: "text/plain", body: "Must be an admin" };
      }
      logger().info(`User ${userName} updated default params: ${JSON.stringify(body)}`);
      const defaultParams = deepMerge(config.defaultParams ?? {}, body);
      await setConfig({ defaultParams });
      return { status: 200, type: "application/json", body: config.defaultParams };
    },
  ),
} satisfies Route;
