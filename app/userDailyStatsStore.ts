import { JsonSchema, jsonType } from "t_rest/server";
import { kvMemoize } from "./kvMemoize.ts";
import { db } from "./db.ts";
import { generationStore } from "./generationStore.ts";
import { hoursToMilliseconds, isSameDay, minutesToMilliseconds } from "date-fns";
import { UTCDateMini } from "date-fns/utc";

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
    let imageCount = 0;
    let pixelCount = 0;

    for await (
      const generation of generationStore.listBy("fromId", {
        after: new Date(Date.UTC(year, month - 1, day)),
        before: new Date(Date.UTC(year, month - 1, day + 1)),
        value: userId,
      })
    ) {
      imageCount++;
      pixelCount += (generation.value.info?.width ?? 0) * (generation.value.info?.height ?? 0);
    }

    return {
      imageCount,
      pixelCount,
      timestamp: Date.now(),
    };
  },
  {
    // expire in 1 minute if was calculated on the same day, otherwise 7-14 days.
    expireIn: (result, year, month, day) => {
      const requestDate = new UTCDateMini(year, month - 1, day);
      const calculatedDate = new UTCDateMini(result.timestamp);
      return isSameDay(requestDate, calculatedDate)
        ? minutesToMilliseconds(1)
        : hoursToMilliseconds(24 * 7 + Math.random() * 24 * 7);
    },
    // should cache if the stats are non-zero
    shouldCache: (result) => result.imageCount > 0 || result.pixelCount > 0,
  },
);
