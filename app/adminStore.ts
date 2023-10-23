import { Store } from "indexed_kv";
import { JsonSchema, jsonType } from "t_rest/server";
import { db } from "./db.ts";

export const adminSchema = {
  type: "object",
  properties: {
    tgUserId: { type: "number" },
    promotedBy: { type: ["string", "null"] },
  },
  required: ["tgUserId", "promotedBy"],
} as const satisfies JsonSchema;

export type Admin = jsonType<typeof adminSchema>;

type AdminIndices = {
  tgUserId: number;
};

export const adminStore = new Store<Admin, AdminIndices>(db, "adminUsers", {
  indices: {
    tgUserId: { getValue: (adminUser) => adminUser.tgUserId },
  },
});
