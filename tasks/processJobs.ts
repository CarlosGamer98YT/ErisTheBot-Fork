import {
  Async,
  Base64,
  FileType,
  FmtDuration,
  Grammy,
  GrammyParseMode,
  GrammyTypes,
  IKV,
  Log,
} from "../deps.ts";
import { bot } from "../bot/mod.ts";
import { getGlobalSession, GlobalData, WorkerData } from "../bot/session.ts";
import { fmt, formatUserChat } from "../utils.ts";
import { SdApiError, sdImg2Img, SdProgressResponse, SdResponse, sdTxt2Img } from "../sd.ts";
import { JobSchema, jobStore } from "../db/jobStore.ts";
import { runningWorkers } from "./pingWorkers.ts";

const logger = () => Log.getLogger();

/**
 * Sends waiting jobs to workers.
 */
export async function processJobs(): Promise<never> {
  const busyWorkers = new Set<string>();
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      // get first waiting job
      const job = await jobStore.getBy("status.type", "waiting").then((jobs) => jobs[0]);
      if (!job) continue;

      // find a worker to handle the job
      const config = await getGlobalSession();
      const worker = config.workers?.find((worker) =>
        runningWorkers.has(worker.id) &&
        !busyWorkers.has(worker.id)
      );
      if (!worker) continue;

      // process the job
      await job.update((value) => ({
        ...value,
        status: {
          type: "processing",
          progress: 0,
          worker: worker.id,
          updatedDate: new Date(),
          message: job.value.status.type !== "done" ? job.value.status.message : undefined,
        },
      }));
      busyWorkers.add(worker.id);
      processJob(job, worker, config)
        .catch(async (err) => {
          logger().error(
            `Job failed for ${formatUserChat(job.value)} via ${worker.id}: ${err}`,
          );
          if (err instanceof Grammy.GrammyError || err instanceof SdApiError) {
            await bot.api.sendMessage(
              job.value.chat.id,
              `Failed to generate your prompt using ${worker.name}: ${err.message}`,
              { reply_to_message_id: job.value.requestMessageId },
            ).catch(() => undefined);
            await job.update({ status: { type: "waiting" } }).catch(() => undefined);
          }
          if (
            err instanceof SdApiError &&
            (
              err.statusCode === 0 /* Network error */ ||
              err.statusCode === 404 ||
              err.statusCode === 401
            )
          ) {
            runningWorkers.delete(worker.id);
            logger().warning(
              `Worker ${worker.id} was marked as offline because of network error`,
            );
          }
          await job.delete().catch(() => undefined);
          if (!(err instanceof Grammy.GrammyError) || err.error_code !== 403 /* blocked bot */) {
            await jobStore.create(job.value);
          }
        })
        .finally(() => busyWorkers.delete(worker.id));
    } catch (err) {
      logger().warning(`Processing jobs failed: ${err}`);
    }
  }
}

async function processJob(job: IKV.Model<JobSchema>, worker: WorkerData, config: GlobalData) {
  logger().debug(
    `Job started for ${formatUserChat(job.value)} using ${worker.id}`,
  );
  const startDate = new Date();

  // if there is already a status message and its older than 10 seconds
  if (
    job.value.status.type === "processing" && job.value.status.message &&
    (Date.now() - job.value.status.message.date * 1000) > 10 * 1000
  ) {
    // delete it
    await bot.api.deleteMessage(
      job.value.status.message.chat.id,
      job.value.status.message.message_id,
    ).catch(() => undefined);
    await job.update((value) => ({
      ...value,
      status: { ...value.status, message: undefined },
    }));
  }

  // we have to check if job is still processing at every step because TypeScript
  if (job.value.status.type === "processing") {
    await bot.api.sendChatAction(job.value.chat.id, "upload_photo", { maxAttempts: 1 })
      .catch(() => undefined);
    // if now there is no status message
    if (!job.value.status.message) {
      // send a new status message
      const statusMessage = await bot.api.sendMessage(
        job.value.chat.id,
        `Generating your prompt now... 0% using ${worker.name}`,
        { reply_to_message_id: job.value.requestMessageId },
      ).catch((err) => {
        // if the request message (the message we are replying to) was deleted
        if (err instanceof Grammy.GrammyError && err.message.match(/repl(y|ied)/)) {
          // jest set the status message to undefined
          return undefined;
        }
        throw err;
      });
      await job.update((value) => ({
        ...value,
        status: { ...value.status, message: statusMessage },
      }));
    } else {
      // edit the existing status message
      await bot.api.editMessageText(
        job.value.status.message.chat.id,
        job.value.status.message.message_id,
        `Generating your prompt now... 0% using ${worker.name}`,
        { maxAttempts: 1 },
      ).catch(() => undefined);
    }
  }

  // if we don't have a status message (it failed sending because request was deleted)
  if (job.value.status.type === "processing" && !job.value.status.message) {
    // cancel the job
    await job.delete();
    logger().info(`Job cancelled for ${formatUserChat(job.value)}`);
    return;
  }

  // reduce size if worker can't handle the resolution
  const size = limitSize(
    { ...config.defaultParams, ...job.value.task.params },
    worker.maxResolution,
  );

  // process the job
  const handleProgress = async (progress: SdProgressResponse) => {
    if (job.value.status.type === "processing" && job.value.status.message) {
      await Promise.all([
        bot.api.sendChatAction(job.value.chat.id, "upload_photo", { maxAttempts: 1 }),
        bot.api.editMessageText(
          job.value.status.message.chat.id,
          job.value.status.message.message_id,
          `Generating your prompt now... ${
            (progress.progress * 100).toFixed(0)
          }% using ${worker.name}`,
          { maxAttempts: 1 },
        ),
        job.update((value) => ({
          ...value,
          status: {
            type: "processing",
            progress: progress.progress,
            worker: worker.id,
            updatedDate: new Date(),
            message: value.status.type !== "done" ? value.status.message : undefined,
          },
        }), { maxAttempts: 1 }),
      ]).catch(() => undefined);
    }
  };
  let response: SdResponse<unknown>;
  const taskType = job.value.task.type; // don't narrow this to never pls typescript
  switch (job.value.task.type) {
    case "txt2img":
      response = await sdTxt2Img(
        worker.api,
        { ...config.defaultParams, ...job.value.task.params, ...size },
        handleProgress,
      );
      break;
    case "img2img": {
      const file = await bot.api.getFile(job.value.task.fileId);
      const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
      const fileBuffer = await fetch(fileUrl).then((resp) => resp.arrayBuffer());
      const fileBase64 = Base64.encode(fileBuffer);
      response = await sdImg2Img(
        worker.api,
        { ...config.defaultParams, ...job.value.task.params, ...size, init_images: [fileBase64] },
        handleProgress,
      );
      break;
    }
    default:
      throw new Error(`Unknown task type: ${taskType}`);
  }

  // change status message to uploading images
  if (job.value.status.type === "processing" && job.value.status.message) {
    await bot.api.editMessageText(
      job.value.status.message.chat.id,
      job.value.status.message.message_id,
      `Uploading your images...`,
    ).catch(() => undefined);
  }

  // render the caption
  // const detailedReply = Object.keys(job.value.params).filter((key) => key !== "prompt").length > 0;
  const detailedReply = true;
  const jobDurationMs = Math.trunc((Date.now() - startDate.getTime()) / 1000) * 1000;
  const { bold } = GrammyParseMode;
  const caption = fmt([
    `${response.info.prompt}\n`,
    ...detailedReply
      ? [
        response.info.negative_prompt
          ? fmt`${bold("Negative prompt:")} ${response.info.negative_prompt}\n`
          : "",
        fmt`${bold("Steps:")} ${response.info.steps}, `,
        fmt`${bold("Sampler:")} ${response.info.sampler_name}, `,
        fmt`${bold("CFG scale:")} ${response.info.cfg_scale}, `,
        fmt`${bold("Seed:")} ${response.info.seed}, `,
        fmt`${bold("Size")}: ${response.info.width}x${response.info.height}, `,
        fmt`${bold("Worker")}: ${worker.id}, `,
        fmt`${bold("Time taken")}: ${FmtDuration.format(jobDurationMs, { ignoreZero: true })}`,
      ]
      : [],
  ]);

  // sending images loop because telegram is unreliable and it would be a shame to lose the images
  let sendMediaAttempt = 0;
  let resultMessages: GrammyTypes.Message.MediaMessage[] | undefined;
  while (true) {
    sendMediaAttempt++;
    await bot.api.sendChatAction(job.value.chat.id, "upload_photo", { maxAttempts: 1 })
      .catch(() => undefined);

    // parse files from reply JSON
    const inputFiles = await Promise.all(
      response.images.map(async (imageBase64, idx) => {
        const imageBuffer = Base64.decode(imageBase64);
        const imageType = await FileType.fileTypeFromBuffer(imageBuffer);
        if (!imageType) throw new Error("Unknown file type returned from worker");
        return Grammy.InputMediaBuilder.photo(
          new Grammy.InputFile(imageBuffer, `image${idx}.${imageType.ext}`),
          // if it can fit, add caption for first photo
          idx === 0 && caption.text.length <= 1024
            ? { caption: caption.text, caption_entities: caption.entities }
            : undefined,
        );
      }),
    );

    // send the result to telegram
    try {
      resultMessages = await bot.api.sendMediaGroup(job.value.chat.id, inputFiles, {
        reply_to_message_id: job.value.requestMessageId,
        maxAttempts: 5,
      });
      break;
    } catch (err) {
      logger().warning(`Sending images (attempt ${sendMediaAttempt}) failed: ${err}`);
      if (sendMediaAttempt >= 6) throw err;
      // wait 2 * 5 seconds before retrying
      for (let i = 0; i < 2; i++) {
        await bot.api.sendChatAction(job.value.chat.id, "upload_photo", { maxAttempts: 1 })
          .catch(() => undefined);
        await Async.delay(5000);
      }
    }
  }

  // send caption in separate message if it couldn't fit
  if (caption.text.length > 1024 && caption.text.length <= 4096) {
    await bot.api.sendMessage(job.value.chat.id, caption.text, {
      reply_to_message_id: resultMessages[0].message_id,
      entities: caption.entities,
    });
  }

  // delete the status message
  if (job.value.status.type === "processing" && job.value.status.message) {
    await bot.api.deleteMessage(
      job.value.status.message.chat.id,
      job.value.status.message.message_id,
    ).catch(() => undefined);
    await job.update((value) => ({
      ...value,
      status: { ...value.status, message: undefined },
    }));
  }

  // update job to status done
  await job.update((value) => ({
    ...value,
    status: { type: "done", info: response.info, startDate, endDate: new Date() },
  }));

  logger().debug(
    `Job finished for ${formatUserChat(job.value)} using ${worker.id}${
      sendMediaAttempt > 1 ? ` after ${sendMediaAttempt} attempts` : ""
    }`,
  );
}

function limitSize(
  { width, height }: { width?: number; height?: number },
  maxResolution: number,
): { width?: number; height?: number } {
  if (!width || !height) return {};
  const ratio = width / height;
  if (width * height > maxResolution) {
    return {
      width: Math.trunc(Math.sqrt(maxResolution * ratio)),
      height: Math.trunc(Math.sqrt(maxResolution / ratio)),
    };
  }
  return { width, height };
}
