import { createEndpoint, createMethodFilter, createPathFilter } from "t_rest/server";
import { bot } from "../bot/mod.ts";
import { getUser } from "./withUser.ts";
import { adminStore } from "../app/adminStore.ts";

export const usersRoute = createPathFilter({
  "{userId}/photo": createMethodFilter({
    GET: createEndpoint(
      { query: null, body: null },
      async ({ params }) => {
        const user = await getUser(Number(params.userId!));
        const photoData = user.photo?.small_file_id
          ? await fetch(
            `https://api.telegram.org/file/bot${bot.token}/${await bot.api.getFile(
              user.photo.small_file_id,
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
        const user = await getUser(Number(params.userId!));
        const [adminEntry] = await adminStore.getBy("tgUserId", { value: user.id });
        const admin = adminEntry?.value;
        return {
          status: 200,
          body: {
            type: "application/json",
            data: { ...user, admin },
          },
        };
      },
    ),
  }),
});
