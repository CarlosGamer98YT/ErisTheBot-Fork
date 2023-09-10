import { Grammy, GrammyParseMode } from "../deps.ts";
import { fmt, getFlagEmoji } from "../utils.ts";
import { runningWorkers } from "../tasks/pingWorkers.ts";
import { jobStore } from "../db/jobStore.ts";
import { Context, logger } from "./mod.ts";

export async function queueCommand(ctx: Grammy.CommandContext<Context>) {
  let formattedMessage = await getMessageText();
  const queueMessage = await ctx.replyFmt(formattedMessage);
  handleFutureUpdates().catch((err) => logger().warning(`Updating queue message failed: ${err}`));

  async function getMessageText() {
    const processingJobs = await jobStore.getBy("status.type", "processing")
      .then((jobs) => jobs.map((job) => ({ ...job.value, place: 0 })));
    const waitingJobs = await jobStore.getBy("status.type", "waiting")
      .then((jobs) => jobs.map((job, index) => ({ ...job.value, place: index + 1 })));
    const jobs = [...processingJobs, ...waitingJobs];
    const config = ctx.session.global;
    const { bold } = GrammyParseMode;
    return fmt([
      "Current queue:\n",
      ...jobs.length > 0
        ? jobs.flatMap((job) => [
          `${job.place}. `,
          fmt`${bold(job.request.from.first_name)} `,
          job.request.from.last_name ? fmt`${bold(job.request.from.last_name)} ` : "",
          job.request.from.username ? `(@${job.request.from.username}) ` : "",
          getFlagEmoji(job.request.from.language_code) ?? "",
          job.request.chat.type === "private"
            ? " in private chat "
            : ` in ${job.request.chat.title} `,
          job.request.chat.type !== "private" && job.request.chat.type !== "group" &&
            job.request.chat.username
            ? `(@${job.request.chat.username}) `
            : "",
          job.status.type === "processing"
            ? `(${(job.status.progress * 100).toFixed(0)}% using ${job.status.worker}) `
            : "",
          "\n",
        ])
        : ["Queue is empty.\n"],
      "\nActive workers:\n",
      ...config.workers.flatMap((worker) => [
        runningWorkers.has(worker.name) ? "✅ " : "☠️ ",
        fmt`${bold(worker.name)} `,
        `(max ${(worker.maxResolution / 1000000).toFixed(1)} Mpx) `,
        "\n",
      ]),
    ]);
  }

  async function handleFutureUpdates() {
    for (let idx = 0; idx < 20; idx++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const nextFormattedMessage = await getMessageText();
      if (nextFormattedMessage.text !== formattedMessage.text) {
        await ctx.api.editMessageText(
          ctx.chat.id,
          queueMessage.message_id,
          nextFormattedMessage.text,
          { entities: nextFormattedMessage.entities },
        );
        formattedMessage = nextFormattedMessage;
      }
    }
  }
}
