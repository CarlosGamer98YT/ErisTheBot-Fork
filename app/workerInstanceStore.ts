import { Store } from "indexed_kv";
import { Static, t } from "elysia";
import { db } from "./db.ts";

export const workerInstanceSchema = t.Object({
  key: t.String(),
  name: t.Nullable(t.String()),
  sdUrl: t.String(),
  sdAuth: t.Nullable(t.Object({
    user: t.String(),
    password: t.String(),
  })),
  lastOnlineTime: t.Optional(t.Number()),
  lastError: t.Optional(t.Object({
    message: t.String(),
    time: t.Number(),
  })),
});

export type WorkerInstance = Static<typeof workerInstanceSchema>;

export const workerInstanceStore = new Store<WorkerInstance>(db, "workerInstances", {
  indices: {},
});
