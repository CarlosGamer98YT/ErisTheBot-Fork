import { InputFile, InputMediaBuilder } from "./deps.ts";
import { bot } from "./bot.ts";
import { getGlobalSession } from "./session.ts";
import { formatOrdinal } from "./intl.ts";
import { SdProgressResponse, SdRequest, txt2img } from "./sd.ts";
import { extFromMimeType, mimeTypeFromBase64 } from "./mimeType.ts";

export const queue: Job[] = [];

interface Job {
  params: Partial<SdRequest>;
  userId: number;
  userName: string;
  chatId: number;
  chatName: string;
  requestMessageId: number;
  statusMessageId: number;
}

export async function processQueue() {
  while (true) {
    const job = queue.shift();
    if (!job) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }
    for (const [index, job] of queue.entries()) {
      const place = index + 1;
      await bot.api
        .editMessageText(
          job.chatId,
          job.statusMessageId,
          `You are ${formatOrdinal(place)} in queue.`,
        )
        .catch(() => {});
    }
    try {
      await bot.api
        .deleteMessage(job.chatId, job.statusMessageId)
        .catch(() => {});
      const progressMessage = await bot.api.sendMessage(
        job.chatId,
        "Generating your prompt now...",
        { reply_to_message_id: job.requestMessageId },
      );
      const onProgress = (progress: SdProgressResponse) => {
        bot.api
          .editMessageText(
            job.chatId,
            progressMessage.message_id,
            `Generating your prompt now... ${
              Math.round(
                progress.progress * 100,
              )
            }%`,
          )
          .catch(() => {});
      };
      const config = await getGlobalSession();
      const response = await txt2img(
        config.sdApiUrl,
        { ...config.defaultParams, ...job.params },
        onProgress,
      );
      console.log(
        `Generated ${response.images.length} images (${
          response.images
            .map((image) => (image.length / 1024).toFixed(0) + "kB")
            .join(", ")
        }) for ${job.userName} in ${job.chatName}: ${job.params.prompt?.replace(/\s+/g, " ")}`,
      );
      await bot.api.editMessageText(
        job.chatId,
        progressMessage.message_id,
        `Uploading your images...`,
      ).catch(() => {});
      const inputFiles = await Promise.all(
        response.images.map(async (imageBase64, idx) => {
          const mimeType = mimeTypeFromBase64(imageBase64);
          const imageBlob = await fetch(`data:${mimeType};base64,${imageBase64}`).then((resp) =>
            resp.blob()
          );
          console.log(
            `Uploading image ${idx + 1} of ${response.images.length} (${
              (imageBlob.size / 1024).toFixed(0)
            }kB)`,
          );
          return InputMediaBuilder.photo(
            new InputFile(imageBlob, `${idx}.${extFromMimeType(mimeType)}`),
          );
        }),
      );
      await bot.api.sendMediaGroup(job.chatId, inputFiles, {
        reply_to_message_id: job.requestMessageId,
      });
      await bot.api
        .deleteMessage(job.chatId, progressMessage.message_id)
        .catch(() => {});
      console.log(`${queue.length} jobs remaining`);
    } catch (err) {
      console.error(
        `Failed to generate image for ${job.userName} in ${job.chatName}: ${job.params.prompt} - ${err}`,
      );
      await bot.api
        .sendMessage(job.chatId, err.toString(), {
          reply_to_message_id: job.requestMessageId,
        })
        .catch(() => bot.api.sendMessage(job.chatId, err.toString()))
        .catch(() => {});
    }
  }
}
