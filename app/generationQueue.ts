import { bot } from "../bot/mod.ts";
import { PngInfo } from "../sd/parsePngInfo.ts";
import * as SdApi from "../sd/sdApi.ts";
import { formatUserChat } from "../utils/formatUserChat.ts";
import { getConfig, SdInstanceData } from "./config.ts";
import { db, fs } from "./db.ts";
import { SdGenerationInfo } from "./generationStore.ts";
import {
  Async,
  AsyncX,
  Base64,
  createOpenApiClient,
  GrammyTypes,
  KVMQ,
  Log,
  ULID,
} from "../deps.ts";
import { formatOrdinal } from "../utils/formatOrdinal.ts";
import { SdError } from "../sd/SdError.ts";
import { uploadQueue } from "./uploadQueue.ts";

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
  replyMessage: GrammyTypes.Message;
  sdInstanceId?: string;
  progress?: number;
}

export const generationQueue = new KVMQ.Queue<GenerationJob>(db, "jobQueue");

export const activeGenerationWorkers = new Map<string, KVMQ.Worker<GenerationJob>>();

/**
 * Initializes queue workers for each SD instance when they become online.
 */
export async function processGenerationQueue() {
  while (true) {
    const config = await getConfig();

    for (const sdInstance of config.sdInstances) {
      const activeWorker = activeGenerationWorkers.get(sdInstance.id);
      if (activeWorker?.isProcessing) continue;

      const workerSdClient = createOpenApiClient<SdApi.paths>({
        baseUrl: sdInstance.api.url,
        headers: { "Authorization": sdInstance.api.auth },
      });

      // check if worker is up
      const activeWorkerStatus = await workerSdClient.GET("/sdapi/v1/memory", {
        signal: AbortSignal.timeout(10_000),
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

      // create worker
      const newWorker = generationQueue.createWorker(async ({ state }, updateJob) => {
        await processGenerationJob(state, updateJob, sdInstance);
      });
      newWorker.addEventListener("error", (e) => {
        logger().error(
          `Generation failed for ${formatUserChat(e.detail.job.state)}: ${e.detail.error}`,
        );
        bot.api.sendMessage(
          e.detail.job.state.requestMessage.chat.id,
          `Generation failed: ${e.detail.error}\n\n` +
            (e.detail.job.retryCount > 0
              ? `Will retry ${e.detail.job.retryCount} more times.`
              : `Aborting.`),
          {
            reply_to_message_id: e.detail.job.state.requestMessage.message_id,
            allow_sending_without_reply: true,
          },
        ).catch(() => undefined);
        if (e.detail.error instanceof SdError) {
          newWorker.stopProcessing();
        }
      });
      newWorker.processJobs();
      activeGenerationWorkers.set(sdInstance.id, newWorker);
      logger().info(`Started worker ${sdInstance.id}`);
    }
    await Async.delay(60_000);
  }
}

/**
 * Processes a single job from the queue.
 */
async function processGenerationJob(
  state: GenerationJob,
  updateJob: (job: Partial<KVMQ.JobData<GenerationJob>>) => Promise<void>,
  sdInstance: SdInstanceData,
) {
  const startDate = new Date();
  const workerSdClient = createOpenApiClient<SdApi.paths>({
    baseUrl: sdInstance.api.url,
    headers: { "Authorization": sdInstance.api.auth },
  });
  state.sdInstanceId = sdInstance.id;
  logger().debug(`Generation started for ${formatUserChat(state)}`);
  await updateJob({ state: state });

  // check if bot can post messages in this chat
  const chat = await bot.api.getChat(state.chat.id);
  if (
    (chat.type === "group" || chat.type === "supergroup") &&
    (!chat.permissions?.can_send_messages || !chat.permissions?.can_send_photos)
  ) {
    throw new Error("Bot doesn't have permissions to send photos in this chat");
  }

  // edit the existing status message
  await bot.api.editMessageText(
    state.replyMessage.chat.id,
    state.replyMessage.message_id,
    `Generating your prompt now... 0% using ${sdInstance.name}`,
    { maxAttempts: 1 },
  );

  // reduce size if worker can't handle the resolution
  const config = await getConfig();
  const size = limitSize(
    { ...config.defaultParams, ...state.task.params },
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
  const responsePromise = state.task.type === "txt2img"
    ? workerSdClient.POST("/sdapi/v1/txt2img", {
      body: {
        ...config.defaultParams,
        ...state.task.params,
        ...size,
        negative_prompt: state.task.params.negative_prompt
          ? state.task.params.negative_prompt
          : config.defaultParams?.negative_prompt,
      },
    })
    : state.task.type === "img2img"
    ? workerSdClient.POST("/sdapi/v1/img2img", {
      body: {
        ...config.defaultParams,
        ...state.task.params,
        ...size,
        negative_prompt: state.task.params.negative_prompt
          ? state.task.params.negative_prompt
          : config.defaultParams?.negative_prompt,
        init_images: [
          Base64.encode(
            await fetch(
              `https://api.telegram.org/file/bot${bot.token}/${await bot.api.getFile(
                state.task.fileId,
              ).then((file) => file.file_path)}`,
            ).then((resp) => resp.arrayBuffer()),
          ),
        ],
      },
    })
    : undefined;

  if (!responsePromise) {
    throw new Error(`Unknown task type: ${state.task.type}`);
  }

  // poll for progress while the generation request is pending
  do {
    const progressResponse = await workerSdClient.GET("/sdapi/v1/progress", {
      params: {},
      signal: AbortSignal.timeout(15000),
    });
    if (!progressResponse.data) {
      throw new SdError(
        "Progress request failed",
        progressResponse.response,
        progressResponse.error,
      );
    }

    state.progress = progressResponse.data.progress;
    await updateJob({ state: state });

    await bot.api.sendChatAction(state.chat.id, "upload_photo", { maxAttempts: 1 })
      .catch(() => undefined);
    await bot.api.editMessageText(
      state.replyMessage.chat.id,
      state.replyMessage.message_id,
      `Generating your prompt now... ${
        (progressResponse.data.progress * 100).toFixed(0)
      }% using ${sdInstance.name}`,
      { maxAttempts: 1 },
    ).catch(() => undefined);

    await Promise.race([Async.delay(3000), responsePromise]).catch(() => undefined);
  } while (await AsyncX.promiseState(responsePromise) === "pending");

  // check response
  const response = await responsePromise;
  if (!response.data) {
    throw new SdError(`${state.task.type} failed`, response.response, response.error);
  }
  if (!response.data.images?.length) {
    throw new Error("No images returned from SD");
  }

  // info field is a json serialized string so we need to parse it
  const info: SdGenerationInfo = JSON.parse(response.data.info);

  // save images to db
  const imageKeys: Deno.KvKey[] = [];
  for (const imageBase64 of response.data.images) {
    const imageBuffer = Base64.decode(imageBase64);
    const imageKey = ["images", "upload", ULID.ulid()];
    await fs.set(imageKey, imageBuffer, { expireIn: 30 * 60 * 1000 });
    imageKeys.push(imageKey);
  }

  // create a new upload job
  await uploadQueue.pushJob({
    chat: state.chat,
    from: state.from,
    requestMessage: state.requestMessage,
    replyMessage: state.replyMessage,
    sdInstanceId: sdInstance.id,
    startDate,
    endDate: new Date(),
    imageKeys,
    info,
  }, { retryCount: 5, retryDelayMs: 10000 });

  // change status message to uploading images
  await bot.api.editMessageText(
    state.replyMessage.chat.id,
    state.replyMessage.message_id,
    `Uploading your images...`,
    { maxAttempts: 1 },
  ).catch(() => undefined);

  logger().debug(`Generation finished for ${formatUserChat(state)}`);
}

/**
 * Handles queue updates and updates the status message.
 */
export async function updateGenerationQueue() {
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
