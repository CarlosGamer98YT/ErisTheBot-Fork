import { subMinutes } from "date-fns";
import { createEndpoint, createMethodFilter, createPathFilter } from "t_rest/server";
import { getDailyStats } from "../app/dailyStatsStore.ts";
import { generationStore } from "../app/generationStore.ts";
import { globalStats } from "../app/globalStats.ts";
import { getUserDailyStats } from "../app/userDailyStatsStore.ts";
import { getUserStats } from "../app/userStatsStore.ts";
import { withAdmin } from "./withUser.ts";

const STATS_INTERVAL_MIN = 3;

export const statsRoute = createPathFilter({
  "": createMethodFilter({
    GET: createEndpoint(
      { query: null, body: null },
      async () => {
        const after = subMinutes(new Date(), STATS_INTERVAL_MIN);
        const generations = await generationStore.getAll({ after });

        const imagesPerMinute = generations.length / STATS_INTERVAL_MIN;

        const stepsPerMinute = generations
          .map((generation) => generation.value.info?.steps ?? 0)
          .reduce((sum, steps) => sum + steps, 0) / STATS_INTERVAL_MIN;

        const pixelsPerMinute = generations
          .map((generation) =>
            (generation.value.info?.width ?? 0) * (generation.value.info?.height ?? 0)
          )
          .reduce((sum, pixels) => sum + pixels, 0) / STATS_INTERVAL_MIN;

        const pixelStepsPerMinute = generations
          .map((generation) =>
            (generation.value.info?.width ?? 0) * (generation.value.info?.height ?? 0) *
            (generation.value.info?.steps ?? 0)
          )
          .reduce((sum, pixelSteps) => sum + pixelSteps, 0) / STATS_INTERVAL_MIN;

        return {
          status: 200,
          body: {
            type: "application/json",
            data: {
              imageCount: globalStats.imageCount,
              stepCount: globalStats.stepCount,
              pixelCount: globalStats.pixelCount,
              pixelStepCount: globalStats.pixelStepCount,
              userCount: globalStats.userIds.length,
              imagesPerMinute,
              stepsPerMinute,
              pixelsPerMinute,
              pixelStepsPerMinute,
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
              timestamp: stats.timestamp,
            },
          },
        };
      },
    ),
  }),
  "users/{userId}/tagcount": createMethodFilter({
    GET: createEndpoint(
      { query: { sessionId: { type: "string" } }, body: null },
      async ({ params, query }) => {
        return withAdmin(query, async () => {
          const userId = Number(params.userId);
          const stats = await getUserStats(userId);
          return {
            status: 200,
            body: {
              type: "application/json",
              data: {
                tagCountMap: stats.tagCountMap,
                timestamp: stats.timestamp,
              },
            },
          };
        });
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
