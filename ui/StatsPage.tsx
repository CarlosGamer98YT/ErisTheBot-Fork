import React from "react";
import { fetchApi, handleResponse } from "./apiClient.ts";
import useSWR from "swr";
import { Counter } from "./Counter.tsx";

export function StatsPage() {
  const getGlobalStats = useSWR(
    ["/stats", {}] as const,
    (args) => fetchApi(...args).then(handleResponse),
    { refreshInterval: 2_000 },
  );

  return (
    <div className="my-16 flex flex-col gap-16 text-zinc-600 dark:text-zinc-400">
      <p className="flex flex-col items-center gap-2 text-2xl sm:text-3xl">
        <span>Pixelsteps diffused</span>
        <Counter
          className="font-bold text-zinc-700 dark:text-zinc-300"
          value={getGlobalStats.data?.pixelStepCount ?? 0}
          digits={15}
          transitionDurationMs={3_000}
        />
        <Counter
          className="text-base"
          value={(getGlobalStats.data?.pixelStepsPerMinute ?? 0) / 60}
          digits={9}
          transitionDurationMs={2_000}
          postfix="/s"
        />
      </p>
      <p className="flex flex-col items-center gap-2 text-2xl sm:text-3xl">
        <span>Pixels painted</span>
        <Counter
          className="font-bold text-zinc-700 dark:text-zinc-300"
          value={getGlobalStats.data?.pixelCount ?? 0}
          digits={15}
          transitionDurationMs={3_000}
        />
        <Counter
          className="text-base"
          value={(getGlobalStats.data?.pixelsPerMinute ?? 0) / 60}
          digits={9}
          transitionDurationMs={2_000}
          postfix="/s"
        />
      </p>
      <div className="flex flex-col md:flex-row gap-16 md:gap-8">
        <p className="flex-grow flex flex-col items-center gap-2 text-2xl">
          <span>Steps processed</span>
          <Counter
            className="font-bold text-zinc-700 dark:text-zinc-300"
            value={getGlobalStats.data?.stepCount ?? 0}
            digits={9}
            transitionDurationMs={3_000}
          />
          <Counter
            className="text-base"
            value={(getGlobalStats.data?.stepsPerMinute ?? 0) / 60}
            digits={3}
            fractionDigits={3}
            transitionDurationMs={2_000}
            postfix="/s"
          />
        </p>
        <p className="flex-grow flex flex-col items-center gap-2 text-2xl">
          <span>Images generated</span>
          <Counter
            className="font-bold text-zinc-700 dark:text-zinc-300"
            value={getGlobalStats.data?.imageCount ?? 0}
            digits={9}
            transitionDurationMs={3_000}
          />
          <Counter
            className="text-base"
            value={(getGlobalStats.data?.imagesPerMinute ?? 0) / 60}
            digits={3}
            fractionDigits={3}
            transitionDurationMs={2_000}
            postfix="/s"
          />
        </p>
      </div>
      <p className="flex-grow flex flex-col items-center gap-2 text-2xl">
        <span>Unique users</span>
        <Counter
          className="font-bold text-zinc-700 dark:text-zinc-300"
          value={getGlobalStats.data?.userCount ?? 0}
          digits={6}
          transitionDurationMs={1_500}
        />
      </p>
    </div>
  );
}
