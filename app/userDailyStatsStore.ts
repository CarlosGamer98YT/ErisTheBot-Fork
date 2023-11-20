import { Static, t } from "elysia";
import { kvMemoize } from "../utils/kvMemoize.ts";
import { db } from "./db.ts";
import { generationStore } from "./generationStore.ts";
import { hoursToMilliseconds, isSameDay, minutesToMilliseconds } from "date-fns";
import { UTCDateMini } from "date-fns/utc";

export const userDailyStatsSchema = t.Object({
  imageCount: t.Number(),
  pixelCount: t.Number(),
  pixelStepCount: t.Number(),
  timestamp: t.Number(),
});

export type UserDailyStats = Static<typeof userDailyStatsSchema>;

export const getUserDailyStats = kvMemoize(
  db,
  ["userDailyStats"],
  async (userId: number, year: number, month: number, day: number): Promise<UserDailyStats> => {
    let imageCount = 0;
    let pixelCount = 0;
    let pixelStepCount = 0;

    for await (
      const generation of generationStore.listBy("fromId", {
        after: new Date(Date.UTC(year, month - 1, day)),
        before: new Date(Date.UTC(year, month - 1, day + 1)),
        value: userId,
      })
    ) {
      imageCount++;
      pixelCount += (generation.value.info?.width ?? 0) * (generation.value.info?.height ?? 0);
      pixelStepCount += (generation.value.info?.width ?? 0) *
        (generation.value.info?.height ?? 0) *
        (generation.value.info?.steps ?? 0);
    }

    return {
      imageCount,
      pixelCount,
      pixelStepCount,
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
    shouldCache: (result) =>
      result.imageCount > 0 || result.pixelCount > 0 || result.pixelStepCount > 0,
  },
);
