import { createEndpoint, createMethodFilter } from "t_rest/server";
import { bot } from "../bot/mod.ts";

export const botRoute = createMethodFilter({
  GET: createEndpoint({ query: null, body: null }, async () => {
    const username = bot.botInfo.username;
    return { status: 200, body: { type: "application/json", data: { username } } };
  }),
});
