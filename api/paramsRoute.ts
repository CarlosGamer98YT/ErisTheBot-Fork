import { deepMerge } from "std/collections/deep_merge.ts";
import { info } from "std/log/mod.ts";
import { createEndpoint, createMethodFilter } from "t_rest/server";
import { configSchema, getConfig, setConfig } from "../app/config.ts";
import { withUser } from "./withUser.ts";

export const paramsRoute = createMethodFilter({
  GET: createEndpoint(
    { query: null, body: null },
    async () => {
      const config = await getConfig();
      return { status: 200, body: { type: "application/json", data: config.defaultParams } };
    },
  ),

  PATCH: createEndpoint(
    {
      query: { sessionId: { type: "string" } },
      body: {
        type: "application/json",
        schema: configSchema.properties.defaultParams,
      },
    },
    async ({ query, body }) => {
      return withUser(query, async (chat) => {
        const config = await getConfig();
        info(`User ${chat.username} updated default params: ${JSON.stringify(body.data)}`);
        const defaultParams = deepMerge(config.defaultParams ?? {}, body.data);
        await setConfig({ defaultParams });
        return { status: 200, body: { type: "application/json", data: config.defaultParams } };
      }, { admin: true });
    },
  ),
});
