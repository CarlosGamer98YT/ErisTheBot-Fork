// deno-lint-ignore-file require-await
import { createEndpoint, createMethodFilter, createPathFilter } from "t_rest/server";
import { liveGlobalStats } from "../app/globalStatsStore.ts";
import { getDailyStats } from "../app/dailyStatsStore.ts";
import { getUserStats } from "../app/userStatsStore.ts";
import { getUserDailyStats } from "../app/userDailyStatsStore.ts";

export const statsRoute = createPathFilter({
  "": createMethodFilter({
    GET: createEndpoint(
      { query: null, body: null },
      async () => {
        const stats = liveGlobalStats;
        return {
          status: 200,
          body: {
            type: "application/json",
            data: {
              imageCount: stats.imageCount,
              pixelCount: stats.pixelCount,
              userCount: stats.userIds.length,
              timestamp: stats.timestamp,
            },
          },
        };
      },
    ),
  }),
  "daily/{year}/{month}/{day}": createMethodFilter({
    GET: createEndpoint(
      { query: null, body: null },
      async ({ params }) => {
        const year = Number(params.year);
        const month = Number(params.month);
        const day = Number(params.day);
        const stats = await getDailyStats(year, month, day);
        return {
          status: 200,
          body: {
            type: "application/json",
            data: {
              imageCount: stats.imageCount,
              pixelCount: stats.pixelCount,
              userCount: stats.userIds.length,
              timestamp: stats.timestamp,
            },
          },
        };
      },
    ),
  }),
  "users/{userId}": createMethodFilter({
    GET: createEndpoint(
      { query: null, body: null },
      async ({ params }) => {
        const userId = Number(params.userId);
        const stats = await getUserStats(userId);
        return {
          status: 200,
          body: {
            type: "application/json",
            data: {
              imageCount: stats.imageCount,
              pixelCount: stats.pixelCount,
              tagCountMap: stats.tagCountMap,
              timestamp: stats.timestamp,
            },
          },
        };
      },
    ),
  }),
  "users/{userId}/daily/{year}/{month}/{day}": createMethodFilter({
    GET: createEndpoint(
      { query: null, body: null },
      async ({ params }) => {
        const userId = Number(params.userId);
        const year = Number(params.year);
        const month = Number(params.month);
        const day = Number(params.day);
        const stats = await getUserDailyStats(userId, year, month, day);
        return {
          status: 200,
          body: {
            type: "application/json",
            data: {
              imageCount: stats.imageCount,
              pixelCount: stats.pixelCount,
              timestamp: stats.timestamp,
            },
          },
        };
      },
    ),
  }),
});
