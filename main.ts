/// <reference lib="deno.unstable" />
import "std/dotenv/load.ts";
import { ConsoleHandler } from "std/log/handlers.ts";
import { LevelName, setup } from "std/log/mod.ts";
import { serveUi } from "./api/mod.ts";
import { runAllTasks } from "./app/mod.ts";
import { runBot } from "./bot/mod.ts";

const logLevel = Deno.env.get("LOG_LEVEL")?.toUpperCase() as LevelName ?? "INFO";

// setup logging
setup({
  handlers: {
    console: new ConsoleHandler(logLevel),
  },
  loggers: {
    default: { level: logLevel, handlers: ["console"] },
  },
});

// run parts of the app
await Promise.all([
  runBot(),
  runAllTasks(),
  serveUi(),
]);
