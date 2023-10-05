import { encode } from "std/encoding/base64.ts";
import { Endpoint, Route } from "t_rest/server";
import { getConfig } from "../app/config.ts";
import { bot } from "../bot/mod.ts";

export const usersRoute = {
  GET: new Endpoint(
    { query: { userId: { type: "number" } }, body: null },
    async ({ query }) => {
      const chat = await bot.api.getChat(query.userId);
      if (chat.type !== "private") {
        throw new Error("Chat is not private");
      }
      const photoData = chat.photo?.small_file_id
        ? encode(
          await fetch(
            `https://api.telegram.org/file/bot${bot.token}/${await bot.api.getFile(
              chat.photo.small_file_id,
            ).then((file) => file.file_path)}`,
          ).then((resp) => resp.arrayBuffer()),
        )
        : undefined;
      const config = await getConfig();
      const isAdmin = config?.adminUsernames?.includes(chat.username);
      return {
        status: 200,
        type: "application/json",
        body: {
          ...chat,
          photoData,
          isAdmin,
        },
      };
    },
  ),
} satisfies Route;
