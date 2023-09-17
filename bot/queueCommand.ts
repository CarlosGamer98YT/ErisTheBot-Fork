import { Grammy, GrammyParseMode } from "../deps.ts";
import { fmt } from "../common/utils.ts";
import { runningWorkers } from "../tasks/pingWorkers.ts";
import { jobStore } from "../db/jobStore.ts";
import { Context, logger } from "./mod.ts";
import { getFlagEmoji } from "../common/getFlagEmoji.ts";

export async function queueCommand(ctx: Grammy.CommandContext<Context>) {
  let formattedMessage = await getMessageText();
  const queueMessage = await ctx.replyFmt(formattedMessage);
  handleFutureUpdates().catch((err) => logger().warning(`Updating queue message failed: ${err}`));

  async function getMessageText() {
    const processingJobs = await jobStore.getBy("status.type", { value: "processing" })
      .then((jobs) => jobs.map((job) => ({ ...job.value, place: 0 })));
    const waitingJobs = await jobStore.getBy("status.type", { value: "waiting" })
      .then((jobs) => jobs.map((job, index) => ({ ...job.value, place: index + 1 })));
    const jobs = [...processingJobs, ...waitingJobs];
    const { bold } = GrammyParseMode;

    return fmt([
      "Current queue:\n",
      ...jobs.length > 0
        ? jobs.flatMap((job) => [
          `${job.place}. `,
          fmt`${bold(job.from.first_name)} `,
          job.from.last_name ? fmt`${bold(job.from.last_name)} ` : "",
          job.from.username ? `(@${job.from.username}) ` : "",
          getFlagEmoji(job.from.language_code) ?? "",
          job.chat.type === "private" ? " in private chat " : ` in ${job.chat.title} `,
          job.chat.type !== "private" && job.chat.type !== "group" &&
            job.chat.username
            ? `(@${job.chat.username}) `
            : "",
          job.status.type === "processing"
            ? `(${(job.status.progress * 100).toFixed(0)}% using ${job.status.worker}) `
            : "",
          "\n",
        ])
        : ["Queue is empty.\n"],
      "\nActive workers:\n",
      ...ctx.session.global.workers.flatMap((worker) => [
        runningWorkers.has(worker.id) ? "✅ " : "☠️ ",
        fmt`${bold(worker.name || worker.id)} `,
        `(max ${(worker.maxResolution / 1000000).toFixed(1)} Mpx) `,
        "\n",
      ]),
    ]);
  }

  async function handleFutureUpdates() {
    for (let idx = 0; idx < 30; idx++) {
      await ctx.api.sendChatAction(ctx.chat.id, "typing", { maxAttempts: 1 } as never);
      await new Promise((resolve) => setTimeout(resolve, 4000));
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
