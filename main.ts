import "https://deno.land/std@0.201.0/dotenv/load.ts";
import { Log } from "./deps.ts";
import { bot } from "./bot/mod.ts";
import { runAllTasks } from "./app/mod.ts";

Log.setup({
  handlers: {
    console: new Log.handlers.ConsoleHandler("DEBUG"),
  },
  loggers: {
    default: { level: "DEBUG", handlers: ["console"] },
  },
});

await Promise.all([
  bot.start(),
  runAllTasks(),
]);
