import React from "react";
import FlipMove from "react-flip-move";
import useSWR from "swr";
import { getFlagEmoji } from "../utils/getFlagEmoji.ts";
import { Progress } from "./Progress.tsx";
import { fetchApi, handleResponse } from "./apiClient.ts";

export function QueuePage() {
  const getJobs = useSWR(
    ["/jobs", {}] as const,
    (args) => fetchApi(...args).then(handleResponse),
    { refreshInterval: 2000 },
  );

  return (
    <FlipMove
      typeName={"ul"}
      className="flex flex-col items-stretch gap-2 p-2 bg-zinc-200 dark:bg-zinc-800 rounded-md"
      enterAnimation="fade"
      leaveAnimation="fade"
    >
      {getJobs.data && getJobs.data.length === 0
        ? <li key="no-jobs" className="text-center text-gray-500">Queue is empty.</li>
        : (
          getJobs.data?.map((job) => (
            <li
              className="flex items-baseline gap-2 bg-zinc-100 dark:bg-zinc-700 px-2 py-1 rounded-md"
              key={job.id}
            >
              <span className="">{job.place}.</span>
              <span>{getFlagEmoji(job.state.from.language_code ?? undefined)}</span>
              <strong>{job.state.from.first_name} {job.state.from.last_name}</strong>
              {job.state.from.username
                ? (
                  <a
                    className="link"
                    href={`https://t.me/${job.state.from.username}`}
                    target="_blank"
                  >
                    @{job.state.from.username}
                  </a>
                )
                : null}
              <span className="flex-grow self-center h-full">
                {job.state.progress != null && (
                  <Progress className="w-full h-full" value={job.state.progress} />
                )}
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {job.state.workerInstanceKey}
              </span>
            </li>
          ))
        )}
    </FlipMove>
  );
}
