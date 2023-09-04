import "https://deno.land/std@0.201.0/dotenv/load.ts";
import { bot } from "./bot.ts";
import { processQueue } from "./queue.ts";

await Promise.all([
  bot.start(),
  processQueue(),
]);
