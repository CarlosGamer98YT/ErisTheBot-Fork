import { Store } from "indexed_kv";
import { JsonSchema, jsonType } from "t_rest/server";
import { db } from "./db.ts";

export const workerInstanceSchema = {
  type: "object",
  properties: {
    // used for counting stats
    key: { type: "string" },
    // used for display
    name: { type: ["string", "null"] },
    sdUrl: { type: "string" },
    sdAuth: {
      type: ["object", "null"],
      properties: {
        user: { type: "string" },
        password: { type: "string" },
      },
      required: ["user", "password"],
    },
    lastOnlineTime: { type: "number" },
    lastError: {
      type: "object",
      properties: {
        message: { type: "string" },
        time: { type: "number" },
      },
      required: ["message", "time"],
    },
  },
  required: ["key", "name", "sdUrl", "sdAuth"],
} as const satisfies JsonSchema;

export type WorkerInstance = jsonType<typeof workerInstanceSchema>;

export const workerInstanceStore = new Store<WorkerInstance>(db, "workerInstances", {
  indices: {},
});
