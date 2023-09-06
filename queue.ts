import { InputFile, InputMediaBuilder, types } from "./deps.ts";
import { bot } from "./bot.ts";
import { getGlobalSession } from "./session.ts";
import { formatOrdinal } from "./intl.ts";
import { SdRequest, txt2img } from "./sd.ts";
import { extFromMimeType, mimeTypeFromBase64 } from "./mimeType.ts";
import { Model, Store } from "./store.ts";

interface Job {
  params: Partial<SdRequest>;
  user: types.User;
  chat: types.Chat.PrivateChat | types.Chat.GroupChat | types.Chat.SupergroupChat;
  requestMessage: types.Message & types.Message.TextMessage;
  statusMessage?: types.Message & types.Message.TextMessage;
  status: { type: "idle" } | { type: "processing"; progress: number; updatedDate: Date };
}

const db = await Deno.openKv("./app.db");

const jobStore = new Store<Job>(db, "job");

export async function pushJob(job: Job) {
  await jobStore.create(job);
}

async function takeJob(): Promise<Model<Job> | null> {
  const jobs = await jobStore.list();
  const job = jobs.find((job) => job.value.status.type === "idle");
  if (!job) return null;
  await job.update({ status: { type: "processing", progress: 0, updatedDate: new Date() } });
  return job;
}

export async function getAllJobs(): Promise<Array<Job>> {
  return await jobStore.list().then((jobs) => jobs.map((job) => job.value));
}

export async function processQueue() {
  while (true) {
    const job = await takeJob();
    if (!job) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }
    let place = 0;
    for (const job of await jobStore.list()) {
      if (job.value.status.type === "idle") place += 1;
      if (place === 0) continue;
      const statusMessageText = `You are ${formatOrdinal(place)} in queue.`;
      if (!job.value.statusMessage) {
        await bot.api.sendMessage(job.value.chat.id, statusMessageText, {
          reply_to_message_id: job.value.requestMessage.message_id,
        }).catch(() => undefined)
          .then((message) => job.update({ statusMessage: message }));
      } else {
        await bot.api.editMessageText(
          job.value.chat.id,
          job.value.statusMessage.message_id,
          statusMessageText,
        )
          .catch(() => undefined);
      }
    }
    try {
      if (job.value.statusMessage) {
        await bot.api
          .deleteMessage(job.value.chat.id, job.value.statusMessage?.message_id)
          .catch(() => undefined)
          .then(() => job.update({ statusMessage: undefined }));
      }
      await bot.api.sendMessage(
        job.value.chat.id,
        "Generating your prompt now...",
        { reply_to_message_id: job.value.requestMessage.message_id },
      ).then((message) => job.update({ statusMessage: message }));
      const config = await getGlobalSession();
      const response = await txt2img(
        config.sdApiUrl,
        { ...config.defaultParams, ...job.value.params },
        (progress) => {
          job.update({
            status: { type: "processing", progress: progress.progress, updatedDate: new Date() },
          });
          if (job.value.statusMessage) {
            bot.api
              .editMessageText(
                job.value.chat.id,
                job.value.statusMessage.message_id,
                `Generating your prompt now... ${
                  Math.round(
                    progress.progress * 100,
                  )
                }%`,
              )
              .catch(() => undefined);
          }
        },
      );
      console.log(
        `Finished job for ${job.value.user.first_name} in ${job.value.chat.type} chat`,
      );
      if (job.value.statusMessage) {
        await bot.api.editMessageText(
          job.value.chat.id,
          job.value.statusMessage.message_id,
          `Uploading your images...`,
        ).catch(() => undefined);
      }
      const inputFiles = await Promise.all(
        response.images.map(async (imageBase64, idx) => {
          const mimeType = mimeTypeFromBase64(imageBase64);
          const imageBlob = await fetch(`data:${mimeType};base64,${imageBase64}`)
            .then((resp) => resp.blob());
          return InputMediaBuilder.photo(
            new InputFile(imageBlob, `image_${idx}.${extFromMimeType(mimeType)}`),
          );
        }),
      );
      if (job.value.statusMessage) {
        await bot.api
          .deleteMessage(job.value.chat.id, job.value.statusMessage.message_id)
          .catch(() => undefined).then(() => job.update({ statusMessage: undefined }));
      }
      await bot.api.sendMediaGroup(job.value.chat.id, inputFiles, {
        reply_to_message_id: job.value.requestMessage.message_id,
      });
      await job.delete();
    } catch (err) {
      console.error(
        `Failed to generate an image for ${job.value.user.first_name} in ${job.value.chat.type} chat: ${err}`,
      );
      const errorMessage = await bot.api
        .sendMessage(job.value.chat.id, err.toString(), {
          reply_to_message_id: job.value.requestMessage.message_id,
        })
        .catch(() => undefined);
      if (errorMessage) {
        if (job.value.statusMessage) {
          await bot.api
            .deleteMessage(job.value.chat.id, job.value.statusMessage.message_id)
            .catch(() => undefined)
            .then(() => job.update({ statusMessage: undefined }));
        }
        job.update({ status: { type: "idle" } });
      } else {
        await job.delete();
      }
    }
  }
}

export async function returnHangedJobs() {
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const jobs = await jobStore.list();
    for (const job of jobs) {
      if (job.value.status.type === "idle") continue;
      // if job wasn't updated for 1 minute, return it to the queue
      if (job.value.status.updatedDate.getTime() < Date.now() - 60 * 1000) {
        console.log(
          `Returning hanged job for ${job.value.user.first_name} in ${job.value.chat.type} chat`,
        );
        await job.update({ status: { type: "idle" } });
      }
    }
  }
}
