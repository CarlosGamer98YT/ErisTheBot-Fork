import { fileTypeFromBuffer } from "file_type";
import { InputFile, InputMediaBuilder } from "grammy";
import { bold, fmt } from "grammy_parse_mode";
import { Chat, Message, User } from "grammy_types";
import { Queue } from "kvmq";
import { format } from "std/fmt/duration.ts";
import { debug, error } from "std/log/mod.ts";
import { bot } from "../bot/mod.ts";
import { formatUserChat } from "../utils/formatUserChat.ts";
import { db, fs } from "./db.ts";
import { generationStore, SdGenerationInfo } from "./generationStore.ts";
import { globalStats } from "./globalStats.ts";

interface UploadJob {
  from: User;
  chat: Chat;
  requestMessage: Message;
  replyMessage: Message;
  workerInstanceKey?: string;
  startDate: Date;
  endDate: Date;
  imageKeys: Deno.KvKey[];
  info: SdGenerationInfo;
}

export const uploadQueue = new Queue<UploadJob>(db, "uploadQueue");

/**
 * Initializes queue worker for uploading images to Telegram.
 */
export async function processUploadQueue() {
  const uploadWorker = uploadQueue.createWorker(async ({ state }) => {
    // change status message to uploading images
    await bot.api.editMessageText(
      state.replyMessage.chat.id,
      state.replyMessage.message_id,
      `Uploading your images...`,
      { maxAttempts: 1 },
    ).catch(() => undefined);

    // render the caption
    // const detailedReply = Object.keys(job.value.params).filter((key) => key !== "prompt").length > 0;
    const detailedReply = true;
    const jobDurationMs = Math.trunc((Date.now() - state.startDate.getTime()) / 1000) * 1000;
    const caption = fmt([
      `${state.info.prompt}\n`,
      ...detailedReply
        ? [
          state.info.negative_prompt
            ? fmt`${bold("Negative prompt:")} ${state.info.negative_prompt}\n`
            : "",
          fmt`${bold("Steps:")} ${state.info.steps}, `,
          fmt`${bold("Sampler:")} ${state.info.sampler_name}, `,
          fmt`${bold("CFG scale:")} ${state.info.cfg_scale}, `,
          fmt`${bold("Seed:")} ${state.info.seed}, `,
          fmt`${bold("Size")}: ${state.info.width}x${state.info.height}, `,
          state.workerInstanceKey ? fmt`${bold("Worker")}: ${state.workerInstanceKey}, ` : "",
          fmt`${bold("Time taken")}: ${format(jobDurationMs, { ignoreZero: true })}`,
        ]
        : [],
    ]);

    // parse files from reply JSON
    let size = 0;
    const types = new Set<string>();
    const inputFiles = await Promise.all(
      state.imageKeys.map(async (fileKey, idx) => {
        const imageBuffer = await fs.get(fileKey).then((entry) => entry.value);
        if (!imageBuffer) throw new Error("File not found");
        const imageType = await fileTypeFromBuffer(imageBuffer);
        if (!imageType) throw new Error("Image has unknown type");
        size += imageBuffer.byteLength;
        types.add(imageType.ext);
        return InputMediaBuilder.photo(
          new InputFile(imageBuffer, `image${idx}.${imageType.ext}`),
          // if it can fit, add caption for first photo
          idx === 0 && caption.text.length <= 1024
            ? { caption: caption.text, caption_entities: caption.entities }
            : undefined,
        );
      }),
    );

    // send the result to telegram
    const resultMessages = await bot.api.sendMediaGroup(state.chat.id, inputFiles, {
      reply_to_message_id: state.requestMessage.message_id,
      allow_sending_without_reply: true,
      maxAttempts: 5,
      maxWait: 60,
    });

    // send caption in separate message if it couldn't fit
    if (caption.text.length > 1024 && caption.text.length <= 4096) {
      await bot.api.sendMessage(state.chat.id, caption.text, {
        reply_to_message_id: resultMessages[0]!.message_id,
        allow_sending_without_reply: true,
        entities: caption.entities,
        maxWait: 60,
      });
    }

    // delete files from storage
    await Promise.all(state.imageKeys.map((fileKey) => fs.delete(fileKey)));

    // save to generation storage
    await generationStore.create({
      from: state.from,
      chat: state.chat,
      sdInstanceId: state.workerInstanceKey,
      startDate: state.startDate,
      endDate: new Date(),
      info: state.info,
    });

    // update live stats
    {
      globalStats.imageCount++;
      globalStats.stepCount += state.info.steps;
      globalStats.pixelCount += state.info.width * state.info.height;
      globalStats.pixelStepCount += state.info.width * state.info.height * state.info.steps;
      const userIdSet = new Set(globalStats.userIds);
      userIdSet.add(state.from.id);
      globalStats.userIds = [...userIdSet];
    }

    debug(
      `Uploaded ${state.imageKeys.length} ${[...types].join(",")} images (${
        Math.trunc(size / 1024)
      }kB) for ${formatUserChat(state)}`,
    );

    // delete the status message
    await bot.api.deleteMessage(state.replyMessage.chat.id, state.replyMessage.message_id)
      .catch(() => undefined);
  }, { concurrency: 10 });

  uploadWorker.addEventListener("error", (e) => {
    error(`Upload failed for ${formatUserChat(e.detail.job.state)}: ${e.detail.error}`);
    bot.api.sendMessage(
      e.detail.job.state.requestMessage.chat.id,
      `Upload failed: ${e.detail.error}\n\n` +
        (e.detail.job.retryCount > 0
          ? `Will retry ${e.detail.job.retryCount} more times.`
          : `Aborting.`),
      {
        reply_to_message_id: e.detail.job.state.requestMessage.message_id,
        allow_sending_without_reply: true,
      },
    ).catch(() => undefined);
  });

  await uploadWorker.processJobs();
}
