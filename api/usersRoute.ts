import { Elysia, t } from "elysia";
import { adminSchema, adminStore } from "../app/adminStore.ts";
import { bot } from "../bot/mod.ts";
import { getUser } from "./getUser.ts";

export const usersRoute = new Elysia()
  .get(
    "/:userId/photo",
    async ({ params }) => {
      const user = await getUser(Number(params.userId));
      if (!user.photo) {
        throw new Error("User has no photo");
      }
      const photoFile = await bot.api.getFile(user.photo.small_file_id);
      const photoData = await fetch(
        `https://api.telegram.org/file/bot${bot.token}/${photoFile.file_path}`,
      ).then((resp) => {
        if (!resp.ok) {
          throw new Error("Failed to fetch photo");
        }
        return resp;
      }).then((resp) => resp.arrayBuffer());

      return new Response(new File([photoData], "avatar.jpg", { type: "image/jpeg" }));
    },
    {
      params: t.Object({ userId: t.String() }),
    },
  )
  .get(
    "/:userId",
    async ({ params }) => {
      const user = await getUser(Number(params.userId));
      const adminEntry = await adminStore.get(["admins", user.id]);
      return {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name ?? null,
        username: user.username ?? null,
        bio: user.bio ?? null,
        admin: adminEntry.value ?? null,
      };
    },
    {
      params: t.Object({ userId: t.String() }),
      response: t.Object({
        id: t.Number(),
        first_name: t.String(),
        last_name: t.Nullable(t.String()),
        username: t.Nullable(t.String()),
        bio: t.Nullable(t.String()),
        admin: t.Nullable(adminSchema),
      }),
    },
  );
