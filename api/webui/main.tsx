/// <reference lib="dom" />
import { QueryClient, QueryClientProvider } from "https://esm.sh/@tanstack/react-query@4.35.3";
import { httpBatchLink } from "https://esm.sh/@trpc/client@10.38.4/links/httpBatchLink";
import { createTRPCReact } from "https://esm.sh/@trpc/react-query@10.38.4";
import { defineConfig, injectGlobal, install, tw } from "https://esm.sh/@twind/core@1.1.3";
import presetTailwind from "https://esm.sh/@twind/preset-tailwind@1.1.4";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import FlipMove from "https://esm.sh/react-flip-move@3.0.5";
import React from "https://esm.sh/react@18.2.0";
import type { AppRouter } from "../mod.ts";

const twConfig = defineConfig({
  presets: [presetTailwind()],
});

install(twConfig);

injectGlobal`
  html {
    @apply h-full bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100;
  }
  body {
    @apply flex min-h-full flex-col items-stretch;
  }
`;

export const trpc = createTRPCReact<AppRouter>();

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
    }),
  ],
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      suspense: true,
    },
  },
});

createRoot(document.body).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>,
);

function App() {
  const allJobs = trpc.getAllGenerationJobs.useQuery(undefined, { refetchInterval: 1000 });
  const processingJobs = (allJobs.data ?? [])
    .filter((job) => new Date(job.lockUntil) > new Date()).map((job) => ({ ...job, index: 0 }));
  const waitingJobs = (allJobs.data ?? [])
    .filter((job) => new Date(job.lockUntil) <= new Date())
    .map((job, index) => ({ ...job, index: index + 1 }));
  const jobs = [...processingJobs, ...waitingJobs];

  return (
    <FlipMove
      typeName={"ul"}
      className={tw("p-4")}
      enterAnimation="fade"
      leaveAnimation="fade"
    >
      {jobs.map((job) => (
        <li key={job.id.join("/")} className={tw("")}>
          {job.index}. {job.state.from.first_name} {job.state.from.last_name}{" "}
          {job.state.from.username} {job.state.from.language_code}{" "}
          {((job.state.progress ?? 0) * 100).toFixed(0)}% {job.state.sdInstanceId}
        </li>
      ))}
    </FlipMove>
  );
}
