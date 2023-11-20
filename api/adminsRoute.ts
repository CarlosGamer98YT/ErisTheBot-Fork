import { info } from "std/log/mod.ts";
import { Elysia, Static, t } from "elysia";
import { Admin, adminSchema, adminStore } from "../app/adminStore.ts";
import { getUser, withSessionAdmin, withSessionUser } from "./getUser.ts";
import { TkvEntry } from "../utils/Tkv.ts";

const adminDataSchema = t.Intersect([adminSchema, t.Object({ tgUserId: t.Number() })]);

export type AdminData = Static<typeof adminDataSchema>;

function getAdminData(adminEntry: TkvEntry<["admins", number], Admin>): AdminData {
  return { tgUserId: adminEntry.key[1], ...adminEntry.value };
}

export const adminsRoute = new Elysia()
  .get(
    "",
    async () => {
      const adminEntries = await Array.fromAsync(adminStore.list({ prefix: ["admins"] }));
      const admins = adminEntries.map(getAdminData);
      return admins;
    },
    {
      response: t.Array(adminDataSchema),
    },
  )
  .post(
    "",
    async ({ query, body, set }) => {
      return withSessionAdmin({ query, set }, async (sessionUser, sessionAdminEntry) => {
        const newAdminUser = await getUser(body.tgUserId);
        const newAdminKey = ["admins", body.tgUserId] as const;
        const newAdminValue = { promotedBy: sessionAdminEntry.key[1] };
        const newAdminResult = await adminStore.atomicSet(newAdminKey, null, newAdminValue);
        if (!newAdminResult.ok) {
          set.status = 409;
          return "User is already an admin";
        }
        info(`User ${sessionUser.first_name} promoted user ${newAdminUser.first_name} to admin`);
        return getAdminData({ ...newAdminResult, key: newAdminKey, value: newAdminValue });
      });
    },
    {
      query: t.Object({ sessionId: t.String() }),
      body: t.Object({
        tgUserId: t.Number(),
      }),
      response: {
        200: adminDataSchema,
        401: t.Literal("Must be logged in"),
        403: t.Literal("Must be an admin"),
        409: t.Literal("User is already an admin"),
      },
    },
  )
  .post(
    "/promote_self",
    // if there are no admins, allow any user to promote themselves
    async ({ query, set }) => {
      return withSessionUser({ query, set }, async (sessionUser) => {
        const adminEntries = await Array.fromAsync(adminStore.list({ prefix: ["admins"] }));
        if (adminEntries.length !== 0) {
          set.status = 409;
          return "You are not allowed to promote yourself";
        }
        const newAdminKey = ["admins", sessionUser.id] as const;
        const newAdminValue = { promotedBy: null };
        const newAdminResult = await adminStore.set(newAdminKey, newAdminValue);
        info(`User ${sessionUser.first_name} promoted themselves to admin`);
        return getAdminData({ ...newAdminResult, key: newAdminKey, value: newAdminValue });
      });
    },
    {
      query: t.Object({ sessionId: t.String() }),
      response: {
        200: adminDataSchema,
        401: t.Literal("Must be logged in"),
        403: t.Literal("Must be an admin"),
        409: t.Literal("You are not allowed to promote yourself"),
      },
    },
  )
  .get(
    "/:adminId",
    async ({ params, set }) => {
      const adminEntry = await adminStore.get(["admins", Number(params.adminId)]);
      if (!adminEntry.versionstamp) {
        set.status = 404;
        return "Admin not found";
      }
      return getAdminData(adminEntry);
    },
    {
      params: t.Object({ adminId: t.String() }),
      response: {
        200: adminDataSchema,
        404: t.Literal("Admin not found"),
      },
    },
  )
  .delete(
    "/:adminId",
    async ({ params, query, set }) => {
      return withSessionAdmin({ query, set }, async (sessionUser) => {
        const deletedAdminEntry = await adminStore.get(["admins", Number(params.adminId)]);
        if (!deletedAdminEntry.versionstamp) {
          set.status = 404;
          return "Admin not found";
        }
        const deletedAdminUser = await getUser(deletedAdminEntry.key[1]);
        await adminStore.delete(["admins", Number(params.adminId)]);
        info(
          `User ${sessionUser.first_name} demoted user ${deletedAdminUser.first_name} from admin`,
        );
        return null;
      });
    },
    {
      params: t.Object({ adminId: t.String() }),
      query: t.Object({ sessionId: t.String() }),
      response: {
        200: t.Null(),
        401: t.Literal("Must be logged in"),
        403: t.Literal("Must be an admin"),
        404: t.Literal("Admin not found"),
      },
    },
  );
