import "https://deno.land/std@0.201.0/dotenv/load.ts";
import { bot } from "./bot.ts";
import { processQueue, returnHangedJobs } from "./queue.ts";
import { log } from "./deps.ts";

log.setup({
  handlers: {
    console: new log.handlers.ConsoleHandler("INFO", {
      formatter: (record) =>
        `[${record.levelName}] ${record.msg} ${
          record.args.map((arg) => JSON.stringify(arg)).join(" ")
        } (${record.datetime.toISOString()})`,
    }),
  },
  loggers: {
    default: { level: "INFO", handlers: ["console"] },
  },
});

await Promise.all([
  bot.start(),
  processQueue(),
  returnHangedJobs(),
]);
