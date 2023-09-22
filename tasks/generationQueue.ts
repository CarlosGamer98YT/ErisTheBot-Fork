import { bot } from "../bot/mod.ts";
import { PngInfo } from "../common/parsePngInfo.ts";
import * as SdApi from "../common/sdApi.ts";
import { formatUserChat } from "../common/formatUserChat.ts";
import { getConfig, SdInstanceData } from "../db/config.ts";
import { db } from "../db/db.ts";
import { generationStore, SdGenerationInfo } from "../db/jobStore.ts";
import {
  Async,
  AsyncX,
  Base64,
  createOpenApiClient,
  FileType,
  FmtDuration,
  Grammy,
  GrammyParseMode,
  GrammyTypes,
  KVMQ,
  Log,
} from "../deps.ts";
import { formatOrdinal } from "../common/formatOrdinal.ts";
import { deadline } from "../common/deadline.ts";
import { SdError } from "../common/SdError.ts";

const logger = () => Log.getLogger();

interface GenerationJob {
  task:
    | {
      type: "txt2img";
      params: Partial<PngInfo>;
    }
    | {
      type: "img2img";
      params: Partial<PngInfo>;
      fileId: string;
    };
  from: GrammyTypes.User;
  chat: GrammyTypes.Chat;
  requestMessage: GrammyTypes.Message;
  replyMessage?: GrammyTypes.Message;
  sdInstanceId?: string;
  progress?: number;
}

export const generationQueue = new KVMQ.Queue<GenerationJob>(db, "jobQueue");

export const activeGenerationWorkers = new Map<string, KVMQ.Worker<GenerationJob>>();

/**
 * Periodically restarts stable diffusion generation workers if they become online.
 */
export async function restartGenerationWorkers() {
  while (true) {
    const config = await getConfig();

    for (const sdInstance of config.sdInstances) {
      const activeWorker = activeGenerationWorkers.get(sdInstance.id);
      if (activeWorker?.isProcessing) continue;

      const activeWorkerSdClient = createOpenApiClient<SdApi.paths>({
        baseUrl: sdInstance.api.url,
        headers: { "Authorization": sdInstance.api.auth },
      });

      // check if worker is up

      const activeWorkerStatus = await activeWorkerSdClient.GET("/sdapi/v1/memory", {
        signal: deadline(10_000),
      })
        .then((response) => {
          if (!response.data) {
            throw new SdError("Failed to get worker status", response.response, response.error);
          }
          return response;
        })
        .catch((error) => {
          logger().warning(`Worker ${sdInstance.id} is down: ${error}`);
        });

      if (!activeWorkerStatus?.data) {
        continue;
      }

      const newWorker = generationQueue.createWorker(({ state, setState }) =>
        processGenerationJob(state, setState, sdInstance)
      );

      logger().info(`Started worker ${sdInstance.id}`);

      newWorker.processJobs();

      newWorker.addEventListener("error", (e) => {
        logger().error(`Job failed for ${formatUserChat(e.detail.job.state)}: ${e.detail.error}`);
        bot.api.sendMessage(
          e.detail.job.state.requestMessage.chat.id,
          `Generating failed: ${e.detail.error}`,
          {
            reply_to_message_id: e.detail.job.state.requestMessage.message_id,
          },
        ).catch(() => undefined);
        // TODO: only stop worker if error is network error
        newWorker.stopProcessing();
      });

      activeGenerationWorkers.set(sdInstance.id, newWorker);
    }
    await Async.delay(60_000);
  }
}

async function processGenerationJob(
  job: GenerationJob,
  setJob: (state: GenerationJob) => Promise<void>,
  sdInstance: SdInstanceData,
) {
  logger().debug(`Job started for ${formatUserChat(job)} using ${sdInstance.id}`);
  const startDate = new Date();
  job.sdInstanceId = sdInstance.id;
  await setJob(job);

  const config = await getConfig();
  const workerSdClient = createOpenApiClient<SdApi.paths>({
    baseUrl: sdInstance.api.url,
    headers: { "Authorization": sdInstance.api.auth },
  });

  // if there is already a status message and its older than 30 seconds
  if (job.replyMessage && (Date.now() - job.replyMessage.date * 1000) > 30_000) {
    // try to delete it
    await bot.api.deleteMessage(job.replyMessage.chat.id, job.replyMessage.message_id)
      .catch(() => undefined);
    job.replyMessage = undefined;
    await setJob(job);
  }

  await bot.api.sendChatAction(job.chat.id, "upload_photo", { maxAttempts: 1 })
    .catch(() => undefined);

  // if now there is no status message
  if (!job.replyMessage) {
    // send a new status message
    job.replyMessage = await bot.api.sendMessage(
      job.chat.id,
      `Generating your prompt now... 0% using ${sdInstance.name}`,
      { reply_to_message_id: job.requestMessage.message_id },
    ).catch((err) => {
      // if the request message (the message we are replying to) was deleted
      if (err instanceof Grammy.GrammyError && err.message.match(/repl(y|ied)/)) {
        // set the status message to undefined
        return undefined;
      }
      throw err;
    });
    await setJob(job);
  } else {
    // edit the existing status message
    await bot.api.editMessageText(
      job.replyMessage.chat.id,
      job.replyMessage.message_id,
      `Generating your prompt now... 0% using ${sdInstance.name}`,
      { maxAttempts: 1 },
    ).catch(() => undefined);
  }

  // if we don't have a status message (it failed sending because request was deleted)
  if (!job.replyMessage) {
    // cancel the job
    logger().info(`Job cancelled for ${formatUserChat(job)}`);
    return;
  }

  // reduce size if worker can't handle the resolution
  const size = limitSize(
    { ...config.defaultParams, ...job.task.params },
    sdInstance.maxResolution,
  );
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

  // start generating the image
  const responsePromise = job.task.type === "txt2img"
    ? workerSdClient.POST("/sdapi/v1/txt2img", {
      body: {
        ...config.defaultParams,
        ...job.task.params,
        ...size,
        negative_prompt: job.task.params.negative_prompt
          ? job.task.params.negative_prompt
          : config.defaultParams?.negative_prompt,
      },
    })
    : job.task.type === "img2img"
    ? workerSdClient.POST("/sdapi/v1/img2img", {
      body: {
        ...config.defaultParams,
        ...job.task.params,
        ...size,
        negative_prompt: job.task.params.negative_prompt
          ? job.task.params.negative_prompt
          : config.defaultParams?.negative_prompt,
        init_images: [
          Base64.encode(
            await fetch(
              `https://api.telegram.org/file/bot${bot.token}/${await bot.api.getFile(
                job.task.fileId,
              ).then((file) => file.file_path)}`,
            ).then((resp) => resp.arrayBuffer()),
          ),
        ],
      },
    })
    : undefined;

  if (!responsePromise) {
    throw new Error(`Unknown task type: ${job.task.type}`);
  }

  // poll for progress while the generation request is pending
  while (await AsyncX.promiseState(responsePromise) === "pending") {
    await Async.delay(3000);
    const progressResponse = await workerSdClient.GET("/sdapi/v1/progress", {
      params: {},
      signal: deadline(15_000),
    });
    if (!progressResponse.data) {
      throw new SdError(
        "Failed to get progress",
        progressResponse.response,
        progressResponse.error,
      );
    }
    job.progress = progressResponse.data.progress;
    await setJob(job);
    await bot.api.sendChatAction(job.chat.id, "upload_photo", { maxAttempts: 1 })
      .catch(() => undefined);
    if (job.replyMessage) {
      await bot.api.editMessageText(
        job.replyMessage.chat.id,
        job.replyMessage.message_id,
        `Generating your prompt now... ${
          (progressResponse.data.progress * 100).toFixed(0)
        }% using ${sdInstance.name}`,
        { maxAttempts: 1 },
      ).catch(() => undefined);
    }
  }
  const response = await responsePromise;

  if (!response.data) {
    throw new SdError("Generating image failed", response.response, response.error);
  }

  if (!response.data.images?.length) {
    throw new Error("No images returned from SD");
  }

  // info field is a json serialized string so we need to parse it
  const info: SdGenerationInfo = JSON.parse(response.data.info);

  // change status message to uploading images
  await bot.api.editMessageText(
    job.replyMessage.chat.id,
    job.replyMessage.message_id,
    `Uploading your images...`,
    { maxAttempts: 1 },
  ).catch(() => undefined);

  // render the caption
  // const detailedReply = Object.keys(job.value.params).filter((key) => key !== "prompt").length > 0;
  const detailedReply = true;
  const jobDurationMs = Math.trunc((Date.now() - startDate.getTime()) / 1000) * 1000;
  const { bold, fmt } = GrammyParseMode;
  const caption = fmt([
    `${info.prompt}\n`,
    ...detailedReply
      ? [
        info.negative_prompt ? fmt`${bold("Negative prompt:")} ${info.negative_prompt}\n` : "",
        fmt`${bold("Steps:")} ${info.steps}, `,
        fmt`${bold("Sampler:")} ${info.sampler_name}, `,
        fmt`${bold("CFG scale:")} ${info.cfg_scale}, `,
        fmt`${bold("Seed:")} ${info.seed}, `,
        fmt`${bold("Size")}: ${info.width}x${info.height}, `,
        fmt`${bold("Worker")}: ${sdInstance.id}, `,
        fmt`${bold("Time taken")}: ${FmtDuration.format(jobDurationMs, { ignoreZero: true })}`,
      ]
      : [],
  ]);

  // sending images loop because telegram is unreliable and it would be a shame to lose the images
  // TODO: separate queue for sending images
  let sendMediaAttempt = 0;
  let resultMessages: GrammyTypes.Message.MediaMessage[] | undefined;
  while (true) {
    sendMediaAttempt++;
    await bot.api.sendChatAction(job.chat.id, "upload_photo", { maxAttempts: 1 })
      .catch(() => undefined);

    // parse files from reply JSON
    const inputFiles = await Promise.all(
      response.data.images.map(async (imageBase64, idx) => {
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
      resultMessages = await bot.api.sendMediaGroup(job.chat.id, inputFiles, {
        reply_to_message_id: job.requestMessage.message_id,
        maxAttempts: 5,
      });
      break;
    } catch (err) {
      logger().warning(
        `Sending images (attempt ${sendMediaAttempt}) for ${
          formatUserChat(job)
        } using ${sdInstance.id} failed: ${err}`,
      );
      if (sendMediaAttempt >= 6) throw err;
      // wait 2 * 5 seconds before retrying
      for (let i = 0; i < 2; i++) {
        await bot.api.sendChatAction(job.chat.id, "upload_photo", { maxAttempts: 1 })
          .catch(() => undefined);
        await Async.delay(5000);
      }
    }
  }

  // send caption in separate message if it couldn't fit
  if (caption.text.length > 1024 && caption.text.length <= 4096) {
    await bot.api.sendMessage(job.chat.id, caption.text, {
      reply_to_message_id: resultMessages[0].message_id,
      entities: caption.entities,
    });
  }

  // delete the status message
  await bot.api.deleteMessage(job.replyMessage.chat.id, job.replyMessage.message_id)
    .catch(() => undefined);
  job.replyMessage = undefined;
  await setJob(job);

  // save to generation storage
  generationStore.create({
    task: { type: job.task.type, params: job.task.params },
    from: job.from,
    chat: job.chat,
    status: {
      startDate,
      endDate: new Date(),
      info: info,
    },
  });

  logger().debug(
    `Job finished for ${formatUserChat(job)} using ${sdInstance.id}${
      sendMediaAttempt > 1 ? ` after ${sendMediaAttempt} attempts` : ""
    }`,
  );
}

/**
 * Updates the status message of all jobs in the queue.
 */
export async function handleGenerationUpdates() {
  while (true) {
    const jobs = await generationQueue.getAllJobs();
    let index = 0;
    for (const job of jobs) {
      if (job.lockUntil > new Date()) {
        // job is currently being processed, the worker will update its status message
        continue;
      }
      if (!job.state.replyMessage) {
        // no status message, nothing to update
        continue;
      }
      index++;
      await bot.api.editMessageText(
        job.state.replyMessage.chat.id,
        job.state.replyMessage.message_id,
        `You are ${formatOrdinal(index)} in queue.`,
        { maxAttempts: 1 },
      ).catch(() => undefined);
    }
    await Async.delay(3000);
  }
}
