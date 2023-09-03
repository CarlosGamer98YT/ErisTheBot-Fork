import {
  Bot,
  Context,
  InputFile,
  InputMediaBuilder,
} from "https://deno.land/x/grammy@v1.18.1/mod.ts";
import { autoQuote } from "https://deno.land/x/grammy_autoquote@v1.1.2/mod.ts";
import {
  fmt,
  hydrateReply,
  ParseModeFlavor,
} from "https://deno.land/x/grammy_parse_mode@1.7.1/mod.ts";
import "https://deno.land/x/dotenv@v3.2.2/load.ts";
import {
  FormattedString,
  bold,
} from "https://deno.land/x/grammy_parse_mode@1.7.1/format.ts";
import { autoRetry } from "https://esm.sh/@grammyjs/auto-retry";
import { MessageEntity } from "https://deno.land/x/grammy@v1.18.1/types.ts";

const maxUserJobs = 3;
const maxJobs = 10;

let pausedReason: string | null = null;

const sdApiUrl = Deno.env.get("SD_API_URL");
if (!sdApiUrl) throw new Error("SD_API_URL not set");
console.log("Using SD API URL:", sdApiUrl);
const sdConfigUrl = new URL("/config", sdApiUrl);
const sdConfigRequest = await fetch(sdConfigUrl);
if (!sdConfigRequest.ok)
  throw new Error(
    `Failed to fetch SD config from ${sdConfigUrl}: ${sdConfigRequest.statusText}`
  );
const sdConfig = await sdConfigRequest.json();
console.log("Using SD WebUI version:", String(sdConfig.version).trim());

const adminUsernames = (Deno.env.get("ADMIN_USERNAMES") ?? "")
  .split(",")
  .filter(Boolean);

const tgBotToken = Deno.env.get("TG_BOT_TOKEN");
if (!tgBotToken) throw new Error("TG_BOT_TOKEN not set");

const bot = new Bot<ParseModeFlavor<Context>>(tgBotToken);
bot.api.config.use(autoRetry({ maxRetryAttempts: 5, maxDelaySeconds: 30 }));

bot.api.setMyShortDescription("I can generate furry images from text");
bot.api.setMyDescription(
  "I can generate furry images from text. Send /txt2img to generate an image."
);
bot.api.setMyCommands([
  { command: "txt2img", description: "Generate an image" },
  { command: "queue", description: "Show the current queue" },
]);

bot.use(autoQuote);
bot.use(hydrateReply);

bot.command("start", (ctx) =>
  ctx.reply("Hello! Use the /txt2img command to generate an image")
);

bot.command("txt2img", async (ctx) => {
  if (!ctx.from?.id) {
    return ctx.reply("I don't know who you are");
  }
  if (pausedReason != null) {
    return ctx.reply(`I'm paused: ${pausedReason}`);
  }
  if (queue.length >= maxJobs) {
    return ctx.reply(
      `The queue is full. Try again later. (Max queue size: ${maxJobs})`
    );
  }
  const jobCount = queue.filter((job) => job.userId === ctx.from.id).length;
  if (jobCount >= maxUserJobs) {
    return ctx.reply(
      `You already have ${maxUserJobs} jobs in queue. Try again later.`
    );
  }
  if (!ctx.match) {
    return ctx.reply("Please describe what you want to see");
  }
  const place = queue.length + 1;
  const queueMessage = await ctx.reply(
    `You are ${formatOrdinal(place)} in queue.`
  );
  const userName = [ctx.from.first_name, ctx.from.last_name]
    .filter(Boolean)
    .join(" ");
  const chatName =
    ctx.chat.type === "supergroup" || ctx.chat.type === "group"
      ? ctx.chat.title
      : "private chat";
  queue.push({
    params: { prompt: ctx.match },
    userId: ctx.from.id,
    userName,
    chatId: ctx.chat.id,
    chatName,
    requestMessageId: ctx.message.message_id,
    statusMessageId: queueMessage.message_id,
  });
  console.log(`Enqueued job for ${userName} in chat ${chatName}`);
});

bot.command("queue", async (ctx) => {
  if (queue.length === 0) return ctx.reply("Queue is empty");
  return await ctx.replyFmt(
    fmt`Current queue:\n\n${fmtArray(
      queue.map(
        (job, index) =>
          fmt`${bold(index + 1)}. ${bold(job.userName)} in ${bold(
            job.chatName
          )}`
      ),
      "\n"
    )}`
  );
});

bot.command("pause", async (ctx) => {
  if (!ctx.from?.username) return;
  if (!adminUsernames.includes(ctx.from.username)) return;
  if (pausedReason != null)
    return await ctx.reply(`Already paused: ${pausedReason}`);
  pausedReason = ctx.match ?? "No reason given";
  return await ctx.reply("Paused");
});

bot.command("resume", async (ctx) => {
  if (!ctx.from?.username) return;
  if (!adminUsernames.includes(ctx.from.username)) return;
  if (pausedReason == null) return await ctx.reply("Already running");
  pausedReason = null;
  return await ctx.reply("Resumed");
});

bot.catch((err) => {
  let msg = "Error processing update";
  const { from, chat } = err.ctx;
  if (from?.first_name) msg += ` from ${from.first_name}`;
  if (from?.last_name) msg += ` ${from.last_name}`;
  if (from?.username) msg += ` (@${from.username})`;
  if (chat?.type === "supergroup" || chat?.type === "group") {
    msg += ` in ${chat.title}`;
    if (chat.type === "supergroup" && chat.username)
      msg += ` (@${chat.username})`;
  }
  console.error(msg, err.error);
});

const queue: Job[] = [];

interface Job {
  params: Partial<SdRequest>;
  userId: number;
  userName: string;
  chatId: number;
  chatName: string;
  requestMessageId: number;
  statusMessageId: number;
}

async function processQueue() {
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
          `You are ${formatOrdinal(place)} in queue.`
        )
        .catch(() => {});
    }
    try {
      await bot.api.deleteMessage(job.chatId, job.statusMessageId);
      const progressMessage = await bot.api.sendMessage(
        job.chatId,
        "Generating your prompt now...",
        { reply_to_message_id: job.requestMessageId }
      );
      const onProgress = (progress: SdProgressResponse) => {
        bot.api
          .editMessageText(
            job.chatId,
            progressMessage.message_id,
            `Generating your prompt now... ${Math.round(
              progress.progress * 100
            )}%`
          )
          .catch(() => {});
      };
      const response = await txt2img(
        { ...defaultParams, ...job.params },
        onProgress
      );
      console.log(
        `Generated image for ${job.userName} in ${job.chatName}: ${job.params.prompt}`
      );
      bot.api.editMessageText(
        job.chatId,
        progressMessage.message_id,
        `Uploading your images...`
      );
      const inputFiles = await Promise.all(
        response.images.slice(1).map(async (imageBase64) => {
          const imageBlob = await fetch(
            `data:${mimeTypeFromBase64(imageBase64)};base64,${imageBase64}`
          ).then((resp) => resp.blob());
          return InputMediaBuilder.photo(new InputFile(imageBlob));
        })
      );
      await bot.api.sendMediaGroup(job.chatId, inputFiles, {
        reply_to_message_id: job.requestMessageId,
      });
      await bot.api.deleteMessage(job.chatId, progressMessage.message_id);
      console.log(`${queue.length} jobs remaining`);
    } catch (err) {
      console.error(
        `Failed to generate image for ${job.userName} in ${job.chatName}: ${job.params.prompt} - ${err}`
      );
      await bot.api
        .sendMessage(job.chatId, err.toString(), {
          reply_to_message_id: job.requestMessageId,
        })
        .catch(() => {});
    }
  }
}

function formatOrdinal(n: number) {
  if (n % 100 === 11 || n % 100 === 12 || n % 100 === 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

const defaultParams: Partial<SdRequest> = {
  batch_size: 3,
  n_iter: 1,
  width: 128 * 5,
  height: 128 * 7,
  steps: 40,
  cfg_scale: 9,
  send_images: true,
  save_images: true,
  negative_prompt:
    "id210 boring_e621_fluffyrock_v4 boring_e621_v4 easynegative ng_deepnegative_v1_75t",
};

function mimeTypeFromBase64(base64: string) {
  if (base64.startsWith("/9j/")) {
    return "image/jpeg";
  }
  if (base64.startsWith("iVBORw0KGgo")) {
    return "image/png";
  }
  if (base64.startsWith("R0lGODlh")) {
    return "image/gif";
  }
  if (base64.startsWith("UklGRg")) {
    return "image/webp";
  }
  throw new Error("Unknown image type");
}

async function txt2img(
  params: Partial<SdRequest>,
  onProgress?: (progress: SdProgressResponse) => void,
  signal?: AbortSignal
): Promise<SdResponse> {
  let response: Response | undefined;
  let error: unknown;
  fetch(new URL("sdapi/v1/txt2img", sdApiUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then(
    (resp) => (response = resp),
    (err) => (error = err)
  );
  try {
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const progressRequest = await fetch(
        new URL("sdapi/v1/progress", sdApiUrl)
      );
      if (progressRequest.ok) {
        const progress = (await progressRequest.json()) as SdProgressResponse;
        onProgress?.(progress);
      }
      if (response != null) {
        if (response.ok) {
          const result = (await response.json()) as SdResponse;
          return result;
        } else {
          throw new Error(
            `Request failed: ${response.status} ${response.statusText}`
          );
        }
      }
      if (error != null) {
        throw error;
      }
      signal?.throwIfAborted();
    }
  } finally {
    if (!response && !error)
      await fetch(new URL("sdapi/v1/interrupt", sdApiUrl), { method: "POST" });
  }
}

interface SdRequest {
  denoising_strength: number;
  prompt: string;
  seed: number;
  sampler_name: unknown;
  batch_size: number;
  n_iter: number;
  steps: number;
  cfg_scale: number;
  width: number;
  height: number;
  negative_prompt: string;
  send_images: boolean;
  save_images: boolean;
}

interface SdResponse {
  images: string[];
  parameters: SdRequest;
  /** Contains serialized JSON */
  info: string;
}

interface SdProgressResponse {
  progress: number;
  eta_relative: number;
  state: SdProgressState;
  /** base64 encoded preview */
  current_image: string | null;
  textinfo: string | null;
}

interface SdProgressState {
  skipped: boolean;
  interrupted: boolean;
  job: string;
  job_count: number;
  job_timestamp: string;
  job_no: number;
  sampling_step: number;
  sampling_steps: number;
}

/** Like {@link fmt} but accepts an array instead of template string. */
function fmtArray(
  stringLikes: FormattedString[],
  separator = ""
): FormattedString {
  let text = "";
  const entities: MessageEntity[] = [];
  for (let i = 0; i < stringLikes.length; i++) {
    const stringLike = stringLikes[i];

    entities.push(
      ...stringLike.entities.map((e) => ({
        ...e,
        offset: e.offset + text.length,
      }))
    );

    text += stringLike.toString();
    if (i < stringLikes.length - 1) text += separator;
  }
  return new FormattedString(text, entities);
}

await Promise.all([bot.start(), processQueue()]);
