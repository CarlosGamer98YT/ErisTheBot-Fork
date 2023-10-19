import { CommandContext } from "grammy";
import { bold, fmt } from "grammy_parse_mode";
import { activeGenerationWorkers, generationQueue } from "../app/generationQueue.ts";
import { workerInstanceStore } from "../app/workerInstanceStore.ts";
import { getFlagEmoji } from "../utils/getFlagEmoji.ts";
import { omitUndef } from "../utils/omitUndef.ts";
import { ErisContext } from "./mod.ts";

export async function queueCommand(ctx: CommandContext<ErisContext>) {
  let formattedMessage = await getMessageText();
  const queueMessage = await ctx.replyFmt(
    formattedMessage,
    omitUndef({
      disable_notification: true,
      reply_to_message_id: ctx.message?.message_id,
    }),
  );
  handleFutureUpdates().catch(() => undefined);

  async function getMessageText() {
    const allJobs = await generationQueue.getAllJobs();
    const workerInstances = await workerInstanceStore.getAll();
    const processingJobs = allJobs
      .filter((job) => job.lockUntil > new Date()).map((job) => ({ ...job, index: 0 }));
    const waitingJobs = allJobs
      .filter((job) => job.lockUntil <= new Date())
      .map((job, index) => ({ ...job, index: index + 1 }));
    const jobs = [...processingJobs, ...waitingJobs];

    return fmt([
      "Current queue:\n",
      ...jobs.length > 0
        ? jobs.flatMap((job) => [
          `${job.index}. `,
          fmt`${bold(job.state.from.first_name)} `,
          job.state.from.last_name ? fmt`${bold(job.state.from.last_name)} ` : "",
          getFlagEmoji(job.state.from.language_code) ?? "",
          job.index === 0 && job.state.progress && job.state.workerInstanceKey
            ? `(${(job.state.progress * 100).toFixed(0)}% using ${job.state.workerInstanceKey}) `
            : "",
          "\n",
        ])
        : ["Queue is empty.\n"],
      "\nActive workers:\n",
      ...workerInstances.flatMap((workerInstace) => [
        activeGenerationWorkers.get(workerInstace.id)?.isProcessing ? "✅ " : "☠️ ",
        fmt`${bold(workerInstace.value.name || workerInstace.value.key)} `,
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
