import { createEndpoint, createMethodFilter, createPathFilter } from "t_rest/server";
import { liveGlobalStats } from "../app/globalStatsStore.ts";
import { getDailyStats } from "../app/dailyStatsStore.ts";

export const statsRoute = createPathFilter({
  "global": createMethodFilter({
    GET: createEndpoint(
      { query: null, body: null },
      async () => {
        return {
          status: 200,
          body: {
            type: "application/json",
            data: liveGlobalStats,
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
        const minDate = new Date("2023-01-01");
        const maxDate = new Date();
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date < minDate || date > maxDate) {
          return {
            status: 404,
            body: { type: "text/plain", data: "Not found" },
          };
        }
        return {
          status: 200,
          body: {
            type: "application/json",
            data: await getDailyStats(year, month, day),
          },
        };
      },
    ),
  }),
});
