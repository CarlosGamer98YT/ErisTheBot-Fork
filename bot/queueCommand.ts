import { Grammy, GrammyParseMode } from "../deps.ts";
import { Context } from "./mod.ts";
import { getFlagEmoji } from "../utils/getFlagEmoji.ts";
import { activeGenerationWorkers, generationQueue } from "../app/generationQueue.ts";
import { getConfig } from "../app/config.ts";

export async function queueCommand(ctx: Grammy.CommandContext<Context>) {
  let formattedMessage = await getMessageText();
  const queueMessage = await ctx.replyFmt(formattedMessage, { disable_notification: true });
  handleFutureUpdates().catch(() => undefined);

  async function getMessageText() {
    const config = await getConfig();
    const allJobs = await generationQueue.getAllJobs();
    const processingJobs = allJobs
      .filter((job) => job.lockUntil > new Date()).map((job) => ({ ...job, index: 0 }));
    const waitingJobs = allJobs
      .filter((job) => job.lockUntil <= new Date())
      .map((job, index) => ({ ...job, index: index + 1 }));
    const jobs = [...processingJobs, ...waitingJobs];
    const { bold, fmt } = GrammyParseMode;

    return fmt([
      "Current queue:\n",
      ...jobs.length > 0
        ? jobs.flatMap((job) => [
          `${job.index}. `,
          fmt`${bold(job.state.from.first_name)} `,
          job.state.from.last_name ? fmt`${bold(job.state.from.last_name)} ` : "",
          job.state.from.username ? `(@${job.state.from.username}) ` : "",
          getFlagEmoji(job.state.from.language_code) ?? "",
          job.state.chat.type === "private" ? " in private chat " : ` in ${job.state.chat.title} `,
          job.state.chat.type !== "private" && job.state.chat.type !== "group" &&
            job.state.chat.username
            ? `(@${job.state.chat.username}) `
            : "",
          job.index === 0 && job.state.progress && job.state.sdInstanceId
            ? `(${(job.state.progress * 100).toFixed(0)}% using ${job.state.sdInstanceId}) `
            : "",
          "\n",
        ])
        : ["Queue is empty.\n"],
      "\nActive workers:\n",
      ...config.sdInstances.flatMap((sdInstance) => [
        activeGenerationWorkers.get(sdInstance.id)?.isProcessing ? "✅ " : "☠️ ",
        fmt`${bold(sdInstance.name || sdInstance.id)} `,
        `(max ${(sdInstance.maxResolution / 1000000).toFixed(1)} Mpx) `,
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
