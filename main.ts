// Load environment variables from .env file
import "https://deno.land/std@0.201.0/dotenv/load.ts";

// Setup logging
import { Log } from "./deps.ts";
Log.setup({
  handlers: {
    console: new Log.handlers.ConsoleHandler("DEBUG"),
  },
  loggers: {
    default: { level: "DEBUG", handlers: ["console"] },
  },
});

// Main program logic
import { bot } from "./bot/mod.ts";
import { runAllTasks } from "./tasks/mod.ts";
await Promise.all([
  bot.start(),
  runAllTasks(),
]);
