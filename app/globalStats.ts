import { addDays } from "date-fns";
import { decodeTime } from "ulid";
import { getDailyStats } from "./dailyStatsStore.ts";
import { generationStore } from "./generationStore.ts";

export interface GlobalStats {
  userIds: number[];
  imageCount: number;
  stepCount: number;
  pixelCount: number;
  pixelStepCount: number;
  timestamp: number;
}

export const globalStats: GlobalStats = await getGlobalStats();

async function getGlobalStats(): Promise<GlobalStats> {
  // find the year/month/day of the first generation
  const startDate = await generationStore.getAll({}, { limit: 1 })
    .then((generations) => generations[0]?.id)
    .then((generationId) => generationId ? new Date(decodeTime(generationId)) : new Date());

  // iterate to today and sum up stats
  const userIdSet = new Set<number>();
  let imageCount = 0;
  let stepCount = 0;
  let pixelCount = 0;
  let pixelStepCount = 0;

  const tomorrow = addDays(new Date(), 1);

  for (
    let date = startDate;
    date < tomorrow;
    date = addDays(date, 1)
  ) {
    const dailyStats = await getDailyStats(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
    );
    for (const userId of dailyStats.userIds) userIdSet.add(userId);
    imageCount += dailyStats.imageCount;
    stepCount += dailyStats.stepCount;
    pixelCount += dailyStats.pixelCount;
    pixelStepCount += dailyStats.pixelStepCount;
  }

  return {
    userIds: [...userIdSet],
    imageCount,
    stepCount,
    pixelCount,
    pixelStepCount,
    timestamp: Date.now(),
  };
}
