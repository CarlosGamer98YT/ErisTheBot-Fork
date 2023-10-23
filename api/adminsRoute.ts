import { Model } from "indexed_kv";
import { info } from "std/log/mod.ts";
import { createEndpoint, createMethodFilter, createPathFilter } from "t_rest/server";
import { Admin, adminSchema, adminStore } from "../app/adminStore.ts";
import { getUser, withAdmin, withUser } from "./withUser.ts";

export type AdminData = Admin & { id: string };

function getAdminData(adminEntry: Model<Admin>): AdminData {
  return { id: adminEntry.id, ...adminEntry.value };
}

export const adminsRoute = createPathFilter({
  "": createMethodFilter({
    GET: createEndpoint(
      {},
      async () => {
        const adminEntries = await adminStore.getAll();
        const admins = adminEntries.map(getAdminData);
        return {
          status: 200,
          body: { type: "application/json", data: admins satisfies AdminData[] },
        };
      },
    ),
    POST: createEndpoint(
      {
        query: {
          sessionId: { type: "string" },
        },
        body: {
          type: "application/json",
          schema: {
            type: "object",
            properties: {
              tgUserId: adminSchema.properties.tgUserId,
            },
            required: ["tgUserId"],
          },
        },
      },
      async ({ query, body }) => {
        return withAdmin(query, async (user, adminEntry) => {
          const newAdminUser = await getUser(body.data.tgUserId);
          const newAdminEntry = await adminStore.create({
            tgUserId: body.data.tgUserId,
            promotedBy: adminEntry.id,
          });
          info(`User ${user.first_name} promoted user ${newAdminUser.first_name} to admin`);
          return {
            status: 200,
            body: { type: "application/json", data: getAdminData(newAdminEntry) },
          };
        });
      },
    ),
  }),

  "promote_self": createMethodFilter({
    POST: createEndpoint(
      {
        query: {
          sessionId: { type: "string" },
        },
      },
      // if there are no admins, allow any user to promote themselves
      async ({ query }) => {
        return withUser(query, async (user) => {
          const adminEntries = await adminStore.getAll();
          if (adminEntries.length === 0) {
            const newAdminEntry = await adminStore.create({
              tgUserId: user.id,
              promotedBy: null,
            });
            info(`User ${user.first_name} promoted themselves to admin`);
            return {
              status: 200,
              body: { type: "application/json", data: getAdminData(newAdminEntry) },
            };
          }
          return {
            status: 403,
            body: { type: "text/plain", data: `You are not allowed to promote yourself` },
          };
        });
      },
    ),
  }),

  "{adminId}": createPathFilter({
    "": createMethodFilter({
      GET: createEndpoint(
        {},
        async ({ params }) => {
          const adminEntry = await adminStore.getById(params.adminId!);
          if (!adminEntry) {
            return { status: 404, body: { type: "text/plain", data: `Admin not found` } };
          }
          return {
            status: 200,
            body: { type: "application/json", data: getAdminData(adminEntry) },
          };
        },
      ),
      DELETE: createEndpoint(
        {
          query: {
            sessionId: { type: "string" },
          },
        },
        async ({ params, query }) => {
          const deletedAdminEntry = await adminStore.getById(params.adminId!);
          if (!deletedAdminEntry) {
            return { status: 404, body: { type: "text/plain", data: `Admin not found` } };
          }
          const deletedAdminUser = await getUser(deletedAdminEntry.value.tgUserId);
          return withUser(query, async (chat) => {
            await deletedAdminEntry.delete();
            info(`User ${chat.first_name} demoted user ${deletedAdminUser.first_name} from admin`);
            return {
              status: 200,
              body: { type: "application/json", data: null },
            };
          });
        },
      ),
    }),
  }),
});
