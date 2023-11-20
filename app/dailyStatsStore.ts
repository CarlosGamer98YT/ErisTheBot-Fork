import { hoursToMilliseconds, isSameDay, minutesToMilliseconds } from "date-fns";
import { UTCDateMini } from "date-fns/utc";
import { Static, t } from "elysia";
import { info } from "std/log/mod.ts";
import { db } from "./db.ts";
import { generationStore } from "./generationStore.ts";
import { kvMemoize } from "../utils/kvMemoize.ts";

export const dailyStatsSchema = t.Object({
  userIds: t.Array(t.Number()),
  imageCount: t.Number(),
  stepCount: t.Number(),
  pixelCount: t.Number(),
  pixelStepCount: t.Number(),
  timestamp: t.Number(),
});

export type DailyStats = Static<typeof dailyStatsSchema>;

export const getDailyStats = kvMemoize(
  db,
  ["dailyStats"],
  async (year: number, month: number, day: number): Promise<DailyStats> => {
    const userIdSet = new Set<number>();
    let imageCount = 0;
    let stepCount = 0;
    let pixelCount = 0;
    let pixelStepCount = 0;

    const after = new Date(Date.UTC(year, month - 1, day));
    const before = new Date(Date.UTC(year, month - 1, day + 1));

    info(`Calculating daily stats for ${year}-${month}-${day}`);

    for await (
      const generation of generationStore.listAll({ after, before })
    ) {
      userIdSet.add(generation.value.from.id);
      imageCount++;
      stepCount += generation.value.info?.steps ?? 0;
      pixelCount += (generation.value.info?.width ?? 0) * (generation.value.info?.height ?? 0);
      pixelStepCount += (generation.value.info?.width ?? 0) *
        (generation.value.info?.height ?? 0) *
        (generation.value.info?.steps ?? 0);
    }

    return {
      userIds: [...userIdSet],
      imageCount,
      stepCount,
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
      result.userIds.length > 0 || result.imageCount > 0 || result.pixelCount > 0,
  },
);
