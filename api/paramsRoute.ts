import { Elysia, t } from "elysia";
import { info } from "std/log/mod.ts";
import { defaultParamsSchema, getConfig, setConfig } from "../app/config.ts";
import { withSessionAdmin } from "./getUser.ts";

export const paramsRoute = new Elysia()
  .get(
    "",
    async () => {
      const config = await getConfig();
      return config.defaultParams;
    },
    {
      response: {
        200: defaultParamsSchema,
      },
    },
  )
  .patch(
    "",
    async ({ query, body, set }) => {
      return withSessionAdmin({ query, set }, async (user) => {
        const config = await getConfig();
        info(`User ${user.first_name} updated default params: ${JSON.stringify(body)}`);
        const defaultParams = { ...config.defaultParams, ...body };
        await setConfig({ defaultParams });
        return config.defaultParams;
      });
    },
    {
      query: t.Object({ sessionId: t.String() }),
      body: defaultParamsSchema,
      response: {
        200: defaultParamsSchema,
        401: t.Literal("Must be logged in"),
        403: t.Literal("Must be an admin"),
      },
    },
  );
