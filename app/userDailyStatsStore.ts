import { JsonSchema, jsonType } from "t_rest/server";
import { kvMemoize } from "./kvMemoize.ts";
import { db } from "./db.ts";
import { generationStore } from "./generationStore.ts";

export const userDailyStatsSchema = {
  type: "object",
  properties: {
    imageCount: { type: "number" },
    pixelCount: { type: "number" },
    timestamp: { type: "number" },
  },
  required: ["imageCount", "pixelCount", "timestamp"],
} as const satisfies JsonSchema;

export type UserDailyStats = jsonType<typeof userDailyStatsSchema>;

export const getUserDailyStats = kvMemoize(
  db,
  ["userDailyStats"],
  async (userId: number, year: number, month: number, day: number): Promise<UserDailyStats> => {
    throw new Error("Not implemented");
  },
);
