import { minutesToMilliseconds } from "date-fns";
import { Store } from "indexed_kv";
import { info } from "std/log/mod.ts";
import { Static, t } from "elysia";
import { db } from "./db.ts";
import { generationStore } from "./generationStore.ts";
import { kvMemoize } from "../utils/kvMemoize.ts";
import { sortBy } from "std/collections/sort_by.ts";

export const userStatsSchema = t.Object({
  userId: t.Number(),
  imageCount: t.Number(),
  stepCount: t.Number(),
  pixelCount: t.Number(),
  pixelStepCount: t.Number(),
  tagCountMap: t.Record(t.String(), t.Number()),
  timestamp: t.Number(),
});

export type UserStats = Static<typeof userStatsSchema>;

type UserStatsIndices = {
  userId: number;
  imageCount: number;
  pixelCount: number;
};

const userStatsStore = new Store<UserStats, UserStatsIndices>(
  db,
  "userStats",
  {
    indices: {
      userId: { getValue: (item) => item.userId },
      imageCount: { getValue: (item) => item.imageCount },
      pixelCount: { getValue: (item) => item.pixelCount },
    },
  },
);

export const getUserStats = kvMemoize(
  db,
  ["userStats"],
  async (userId: number): Promise<UserStats> => {
    let imageCount = 0;
    let stepCount = 0;
    let pixelCount = 0;
    let pixelStepCount = 0;
    const tagCountMap = new Map<string, number>();

    info(`Calculating user stats for ${userId}`);

    for await (
      const generation of generationStore.listBy("fromId", { value: userId })
    ) {
      imageCount++;
      stepCount += generation.value.info?.steps ?? 0;
      pixelCount += (generation.value.info?.width ?? 0) * (generation.value.info?.height ?? 0);
      pixelStepCount += (generation.value.info?.width ?? 0) *
        (generation.value.info?.height ?? 0) *
        (generation.value.info?.steps ?? 0);

      const tags = generation.value.info?.prompt
        // split on punctuation and newlines
        .split(/[,;.]\s+|\n/)
        // remove `:weight` syntax
        .map((tag) => tag.replace(/:[\d\.]+/g, ""))
        // remove `(tag)` and `[tag]` syntax
        .map((tag) => tag.replace(/[()[\]]/g, " "))
        // collapse multiple whitespace to one
        .map((tag) => tag.replace(/\s+/g, " "))
        // trim whitespace
        .map((tag) => tag.trim())
        // remove empty tags
        .filter((tag) => tag.length > 0)
        // lowercase tags
        .map((tag) => tag.toLowerCase()) ??
        // default to empty array
        [];

      for (const tag of tags) {
        const count = tagCountMap.get(tag) ?? 0;
        tagCountMap.set(tag, count + 1);
      }
    }

    const tagCountObj = Object.fromEntries(
      sortBy(
        Array.from(tagCountMap.entries()),
        ([_tag, count]) => -count,
      ).filter(([_tag, count]) => count >= 3),
    );

    return {
      userId,
      imageCount,
      stepCount,
      pixelCount,
      pixelStepCount,
      tagCountMap: tagCountObj,
      timestamp: Date.now(),
    };
  },
  {
    // expire in random time between 5-10 minutes
    expireIn: () => minutesToMilliseconds(5 + Math.random() * 5),
    // override default set/get behavior to use userStatsStore
    override: {
      get: async (_key, [userId]) => {
        const items = await userStatsStore.getBy("userId", { value: userId }, { reverse: true });
        return items[0]?.value;
      },
      set: async (_key, [userId], value, options) => {
        // delete old stats
        for await (const item of userStatsStore.listBy("userId", { value: userId })) {
          await item.delete();
        }
        // set new stats
        await userStatsStore.create(value, options);
      },
    },
  },
);
