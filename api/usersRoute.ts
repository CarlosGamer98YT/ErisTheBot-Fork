import { createEndpoint, createMethodFilter, createPathFilter } from "t_rest/server";
import { getConfig } from "../app/config.ts";
import { bot } from "../bot/mod.ts";

export const usersRoute = createPathFilter({
  "{userId}/photo": createMethodFilter({
    GET: createEndpoint(
      { query: null, body: null },
      async ({ params }) => {
        const chat = await bot.api.getChat(params.userId);
        if (chat.type !== "private") {
          throw new Error("Chat is not private");
        }
        const photoData = chat.photo?.small_file_id
          ? await fetch(
            `https://api.telegram.org/file/bot${bot.token}/${await bot.api.getFile(
              chat.photo.small_file_id,
            ).then((file) => file.file_path)}`,
          ).then((resp) => resp.arrayBuffer())
          : undefined;
        if (!photoData) {
          return { status: 404, body: { type: "text/plain", data: "User has no photo" } };
        }
        return {
          status: 200,
          body: {
            type: "image/jpeg",
            data: new Blob([photoData], { type: "image/jpeg" }),
          },
        };
      },
    ),
  }),

  "{userId}": createMethodFilter({
    GET: createEndpoint(
      { query: null, body: null },
      async ({ params }) => {
        const chat = await bot.api.getChat(params.userId);
        if (chat.type !== "private") {
          throw new Error("Chat is not private");
        }
        const config = await getConfig();
        const isAdmin = chat.username && config?.adminUsernames?.includes(chat.username);
        return {
          status: 200,
          body: {
            type: "application/json",
            data: { ...chat, isAdmin },
          },
        };
      },
    ),
  }),
});
