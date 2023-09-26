import "std/dotenv/load.ts";
import { ConsoleHandler } from "std/log/handlers.ts";
import { setup } from "std/log/mod.ts";
import { serveApi } from "./api/mod.ts";
import { runAllTasks } from "./app/mod.ts";
import { bot } from "./bot/mod.ts";

// setup logging
setup({
  handlers: {
    console: new ConsoleHandler("DEBUG"),
  },
  loggers: {
    default: { level: "DEBUG", handlers: ["console"] },
  },
});

// run parts of the app
await Promise.all([
  bot.start(),
  runAllTasks(),
  serveApi(),
]);
