import { Base64, FileType, FmtDuration, Grammy, GrammyParseMode, IKV, Log } from "../deps.ts";
import { bot } from "../bot/mod.ts";
import { getGlobalSession, GlobalData, WorkerData } from "../bot/session.ts";
import { fmt, formatUserChat } from "../utils.ts";
import { SdApiError, sdTxt2Img } from "../sd.ts";
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
        runningWorkers.has(worker.name) &&
        !busyWorkers.has(worker.name)
      );
      if (!worker) continue;

      // process the job
      await job.update({
        status: { type: "processing", progress: 0, worker: worker.name, updatedDate: new Date() },
      });

      busyWorkers.add(worker.name);
      processJob(job, worker, config)
        .catch(async (err) => {
          logger().error(
            `Job failed for ${formatUserChat(job.value.request)} via ${worker.name}: ${err}`,
          );
          if (err instanceof Grammy.GrammyError || err instanceof SdApiError) {
            await bot.api.sendMessage(
              job.value.request.chat.id,
              `Failed to generate your prompt: ${err.message}`,
              { reply_to_message_id: job.value.request.message_id },
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
            runningWorkers.delete(worker.name);
            logger().warning(
              `Worker ${worker.name} was marked as offline because of network error`,
            );
          }
          await job.delete().catch(() => undefined);
          if (!(err instanceof Grammy.GrammyError) || err.error_code !== 403 /* blocked bot */) {
            await jobStore.create(job.value);
          }
        })
        .finally(() => busyWorkers.delete(worker.name));
    } catch (err) {
      logger().warning(`Processing jobs failed: ${err}`);
    }
  }
}

async function processJob(job: IKV.Model<JobSchema>, worker: WorkerData, config: GlobalData) {
  logger().debug(
    `Job started for ${formatUserChat(job.value.request)} using ${worker.name}`,
  );
  const startDate = new Date();

  // if there is already a status message delete it
  if (job.value.reply) {
    await bot.api.deleteMessage(job.value.reply.chat.id, job.value.reply.message_id)
      .catch(() => undefined);
  }

  // send a new status message
  const newStatusMessage = await bot.api.sendMessage(
    job.value.request.chat.id,
    `Generating your prompt now... 0% using ${worker.name}`,
    { reply_to_message_id: job.value.request.message_id },
  ).catch((err) => {
    // don't error if the request message was deleted
    if (err instanceof Grammy.GrammyError && err.message.match(/repl(y|ied)/)) return null;
    else throw err;
  });
  // if the request message was deleted, cancel the job
  if (!newStatusMessage) {
    await job.delete();
    logger().info(
      `Job cancelled for ${formatUserChat(job.value.request)}`,
    );
    return;
  }
  await job.update({ reply: newStatusMessage });

  // reduce size if worker can't handle the resolution
  const size = limitSize({ ...config.defaultParams, ...job.value.params }, worker.maxResolution);

  // process the job
  const response = await sdTxt2Img(
    worker.api,
    { ...config.defaultParams, ...job.value.params, ...size },
    async (progress) => {
      // important: don't let any errors escape this callback
      if (job.value.reply) {
        await bot.api.editMessageText(
          job.value.reply.chat.id,
          job.value.reply.message_id,
          `Generating your prompt now... ${
            (progress.progress * 100).toFixed(0)
          }% using ${worker.name}`,
        ).catch(() => undefined);
      }
      await job.update({
        status: {
          type: "processing",
          progress: progress.progress,
          worker: worker.name,
          updatedDate: new Date(),
        },
      }).catch(() => undefined);
    },
  );

  // upload the result
  if (job.value.reply) {
    await bot.api.editMessageText(
      job.value.reply.chat.id,
      job.value.reply.message_id,
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
        fmt`${bold("Worker")}: ${worker.name}, `,
        fmt`${bold("Time taken")}: ${FmtDuration.format(jobDurationMs, { ignoreZero: true })}`,
      ]
      : [],
  ]);

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
  const resultMessage = await bot.api.sendMediaGroup(job.value.request.chat.id, inputFiles, {
    reply_to_message_id: job.value.request.message_id,
  });
  // send caption in separate message if it couldn't fit
  if (caption.text.length > 1024 && caption.text.length <= 4096) {
    await bot.api.sendMessage(job.value.request.chat.id, caption.text, {
      reply_to_message_id: resultMessage[0].message_id,
      entities: caption.entities,
    });
  }

  // delete the status message
  if (job.value.reply) {
    await bot.api.deleteMessage(job.value.reply.chat.id, job.value.reply.message_id)
      .catch(() => undefined)
      .then(() => job.update({ reply: undefined }))
      .catch(() => undefined);
  }

  // update job to status done
  await job.update({
    status: { type: "done", info: response.info, startDate, endDate: new Date() },
  });
  logger().debug(
    `Job finished for ${formatUserChat(job.value.request)} using ${worker.name}`,
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
