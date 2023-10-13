import "std/dotenv/load.ts";
import { ConsoleHandler } from "std/log/handlers.ts";
import { setup } from "std/log/mod.ts";
import { serveUi } from "./api/mod.ts";
import { runAllTasks } from "./app/mod.ts";
import { runBot } from "./bot/mod.ts";

// setup logging
setup({
  handlers: {
    console: new ConsoleHandler("INFO"),
  },
  loggers: {
    default: { level: "INFO", handlers: ["console"] },
  },
});

// run parts of the app
await Promise.all([
  runBot(),
  runAllTasks(),
  serveUi(),
]);
