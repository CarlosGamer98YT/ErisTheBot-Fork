import { Elysia, t } from "elysia";
import { subMinutes } from "date-fns";
import { dailyStatsSchema, getDailyStats } from "../app/dailyStatsStore.ts";
import { generationStore } from "../app/generationStore.ts";
import { globalStats } from "../app/globalStats.ts";
import { getUserDailyStats, userDailyStatsSchema } from "../app/userDailyStatsStore.ts";
import { getUserStats, userStatsSchema } from "../app/userStatsStore.ts";
import { withSessionAdmin } from "./getUser.ts";

const STATS_INTERVAL_MIN = 3;

export const statsRoute = new Elysia()
  .get(
    "",
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
        imageCount: globalStats.imageCount,
        stepCount: globalStats.stepCount,
        pixelCount: globalStats.pixelCount,
        pixelStepCount: globalStats.pixelStepCount,
        userCount: globalStats.userIds.length,
        imagesPerMinute,
        stepsPerMinute,
        pixelsPerMinute,
        pixelStepsPerMinute,
      };
    },
    {
      response: {
        200: t.Object({
          imageCount: t.Number(),
          stepCount: t.Number(),
          pixelCount: t.Number(),
          pixelStepCount: t.Number(),
          userCount: t.Number(),
          imagesPerMinute: t.Number(),
          stepsPerMinute: t.Number(),
          pixelsPerMinute: t.Number(),
          pixelStepsPerMinute: t.Number(),
        }),
      },
    },
  )
  .get(
    "/daily/:year/:month/:day",
    async ({ params }) => {
      return getDailyStats(params.year, params.month, params.day);
    },
    {
      params: t.Object({
        year: t.Number(),
        month: t.Number(),
        day: t.Number(),
      }),
      response: {
        200: dailyStatsSchema,
      },
    },
  )
  .get(
    "/users/:userId",
    async ({ params }) => {
      const userId = params.userId;
      // deno-lint-ignore no-unused-vars
      const { tagCountMap, ...stats } = await getUserStats(userId);
      return stats;
    },
    {
      params: t.Object({ userId: t.Number() }),
      response: {
        200: t.Omit(userStatsSchema, ["tagCountMap"]),
      },
    },
  )
  .get(
    "/users/:userId/tagcount",
    async ({ params, query, set }) => {
      return withSessionAdmin({ query, set }, async () => {
        const stats = await getUserStats(params.userId);
        return {
          tagCountMap: stats.tagCountMap,
          timestamp: stats.timestamp,
        };
      });
    },
    {
      params: t.Object({ userId: t.Number() }),
      query: t.Object({ sessionId: t.String() }),
      response: {
        200: t.Pick(userStatsSchema, ["tagCountMap", "timestamp"]),
        401: t.Literal("Must be logged in"),
        403: t.Literal("Must be an admin"),
      },
    },
  )
  .get(
    "/users/:userId/daily/:year/:month/:day",
    async ({ params }) => {
      return getUserDailyStats(params.userId, params.year, params.month, params.day);
    },
    {
      params: t.Object({
        userId: t.Number(),
        year: t.Number(),
        month: t.Number(),
        day: t.Number(),
      }),
      response: {
        200: userDailyStatsSchema,
      },
    },
  );
