import { Elysia, t } from "elysia";
import { bot } from "../bot/mod.ts";

export const botRoute = new Elysia()
  .get(
    "",
    async () => {
      const username = bot.botInfo.username;
      return { username };
    },
    {
      response: t.Object({ username: t.String() }),
    },
  );
