import React from "react";
import { fetchApi, handleResponse } from "./apiClient.tsx";
import useSWR from "swr";
import { eachDayOfInterval, endOfMonth, startOfMonth, subMonths } from "date-fns";
import { UTCDateMini } from "@date-fns/utc";
import { Counter } from "./Counter.tsx";

export function HomePage() {
  const globalStats = useSWR(
    ["stats", "GET", {}] as const,
    (args) => fetchApi(...args).then(handleResponse),
    { refreshInterval: 2_000 },
  );

  return (
    <div className="my-16 flex flex-col gap-16 text-zinc-600 dark:text-zinc-400">
      <p className="flex flex-col items-center gap-2 text-2xl sm:text-3xl">
        <span>Pixels painted</span>
        <Counter
          className="font-bold text-zinc-700 dark:text-zinc-300"
          value={globalStats.data?.pixelCount ?? 0}
          digits={12}
          transitionDurationMs={3_000}
        />
      </p>
      <div className="flex flex-col md:flex-row gap-16 md:gap-8">
        <p className="flex-grow flex flex-col items-center gap-2 text-2xl">
          <span>Images generated</span>
          <Counter
            className="font-bold text-zinc-700 dark:text-zinc-300"
            value={globalStats.data?.imageCount ?? 0}
            digits={9}
            transitionDurationMs={1_500}
          />
        </p>
        <p className="flex-grow flex flex-col items-center gap-2 text-2xl">
          <span>Unique users</span>
          <Counter
            className="font-bold text-zinc-700 dark:text-zinc-300"
            value={globalStats.data?.userCount ?? 0}
            digits={6}
            transitionDurationMs={1_500}
          />
        </p>
      </div>
    </div>
  );
}
