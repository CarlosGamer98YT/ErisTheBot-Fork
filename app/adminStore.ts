import { Static, t } from "elysia";
import { db } from "./db.ts";
import { Tkv } from "../utils/Tkv.ts";

export const adminSchema = t.Object({
  promotedBy: t.Nullable(t.Number()),
});

export type Admin = Static<typeof adminSchema>;

export const adminStore = new Tkv<["admins", number], Admin>(db);
