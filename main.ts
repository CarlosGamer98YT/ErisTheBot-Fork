import "https://deno.land/std@0.201.0/dotenv/load.ts";
import { handlers, setup } from "std/log";
import { runAllTasks } from "./app/mod.ts";
import { bot } from "./bot/mod.ts";

setup({
  handlers: {
    console: new handlers.ConsoleHandler("DEBUG"),
  },
  loggers: {
    default: { level: "DEBUG", handlers: ["console"] },
  },
});

await Promise.all([
  bot.start(),
  runAllTasks(),
]);
