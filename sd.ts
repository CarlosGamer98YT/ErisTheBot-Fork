import { Async, AsyncX, PngChunksExtract, PngChunkText } from "./deps.ts";

const neverSignal = new AbortController().signal;

export interface SdApi {
  url: string;
  auth?: string;
}

async function fetchSdApi<T>(api: SdApi, endpoint: string, body?: unknown): Promise<T> {
  let options: RequestInit | undefined;
  if (body != null) {
    options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...api.auth ? { Authorization: api.auth } : {},
      },
      body: JSON.stringify(body),
    };
  } else if (api.auth) {
    options = {
      headers: { Authorization: api.auth },
    };
  }
  const response = await fetch(new URL(endpoint, api.url), options).catch(() => {
    throw new SdApiError(endpoint, options, 0, "Network error");
  });
  const result = await response.json().catch(() => {
    throw new SdApiError(endpoint, options, response.status, response.statusText, {
      detail: "Invalid JSON",
    });
  });
  if (!response.ok) {
    throw new SdApiError(endpoint, options, response.status, response.statusText, result);
  }
  return result;
}

export async function sdTxt2Img(
  api: SdApi,
  params: Partial<SdTxt2ImgRequest>,
  onProgress?: (progress: SdProgressResponse) => void,
  signal: AbortSignal = neverSignal,
): Promise<SdTxt2ImgResponse> {
  const request = fetchSdApi<SdTxt2ImgResponse>(api, "sdapi/v1/txt2img", params)
    // JSON field "info" is a JSON-serialized string so we need to parse this part second time
    .then((data) => ({
      ...data,
      info: typeof data.info === "string" ? JSON.parse(data.info) : data.info,
    }));

  try {
    while (true) {
      await Async.abortable(Promise.race([request, Async.delay(3000)]), signal);
      if (await AsyncX.promiseState(request) !== "pending") return await request;
      onProgress?.(await fetchSdApi<SdProgressResponse>(api, "sdapi/v1/progress"));
    }
  } finally {
    if (await AsyncX.promiseState(request) === "pending") {
      await fetchSdApi(api, "sdapi/v1/interrupt", {});
    }
  }
}

export interface SdTxt2ImgRequest {
  enable_hr: boolean;
  denoising_strength: number;
  firstphase_width: number;
  firstphase_height: number;
  hr_scale: number;
  hr_upscaler: unknown;
  hr_second_pass_steps: number;
  hr_resize_x: number;
  hr_resize_y: number;
  hr_sampler_name: unknown;
  hr_prompt: string;
  hr_negative_prompt: string;
  prompt: string;
  styles: unknown;
  seed: number;
  subseed: number;
  subseed_strength: number;
  seed_resize_from_h: number;
  seed_resize_from_w: number;
  sampler_name: unknown;
  batch_size: number;
  n_iter: number;
  steps: number;
  cfg_scale: number;
  width: number;
  height: number;
  restore_faces: boolean;
  tiling: boolean;
  do_not_save_samples: boolean;
  do_not_save_grid: boolean;
  negative_prompt: string;
  eta: unknown;
  s_min_uncond: number;
  s_churn: number;
  s_tmax: unknown;
  s_tmin: number;
  s_noise: number;
  override_settings: object;
  override_settings_restore_afterwards: boolean;
  script_args: unknown[];
  sampler_index: string;
  script_name: unknown;
  send_images: boolean;
  save_images: boolean;
  alwayson_scripts: object;
}

export interface SdTxt2ImgResponse {
  images: string[];
  parameters: SdTxt2ImgRequest;
  // Warning: raw response from API is a JSON-serialized string
  info: SdTxt2ImgInfo;
}

export interface SdTxt2ImgInfo {
  prompt: string;
  all_prompts: string[];
  negative_prompt: string;
  all_negative_prompts: string[];
  seed: number;
  all_seeds: number[];
  subseed: number;
  all_subseeds: number[];
  subseed_strength: number;
  width: number;
  height: number;
  sampler_name: string;
  cfg_scale: number;
  steps: number;
  batch_size: number;
  restore_faces: boolean;
  face_restoration_model: unknown;
  sd_model_hash: string;
  seed_resize_from_w: number;
  seed_resize_from_h: number;
  denoising_strength: number;
  extra_generation_params: SdTxt2ImgInfoExtraParams;
  index_of_first_image: number;
  infotexts: string[];
  styles: unknown[];
  job_timestamp: string;
  clip_skip: number;
  is_using_inpainting_conditioning: boolean;
}

export interface SdTxt2ImgInfoExtraParams {
  "Lora hashes": string;
  "TI hashes": string;
}

export interface SdProgressResponse {
  progress: number;
  eta_relative: number;
  state: SdProgressState;
  /** base64 encoded preview */
  current_image: string | null;
  textinfo: string | null;
}

export interface SdProgressState {
  skipped: boolean;
  interrupted: boolean;
  job: string;
  job_count: number;
  job_timestamp: string;
  job_no: number;
  sampling_step: number;
  sampling_steps: number;
}

export function sdGetConfig(api: SdApi): Promise<SdConfigResponse> {
  return fetchSdApi(api, "config");
}

export interface SdConfigResponse {
  /** version with new line at the end for some reason */
  version: string;
  mode: string;
  dev_mode: boolean;
  analytics_enabled: boolean;
  components: object[];
  css: unknown;
  title: string;
  is_space: boolean;
  enable_queue: boolean;
  show_error: boolean;
  show_api: boolean;
  is_colab: boolean;
  stylesheets: unknown[];
  theme: string;
  layout: object;
  dependencies: object[];
  root: string;
}

export interface SdErrorResponse {
  /**
   * The HTTP status message or array of invalid fields.
   * Can also be empty string.
   */
  detail: string | Array<{ loc: string[]; msg: string; type: string }>;
  /** Can be e.g. "OutOfMemoryError" or undefined. */
  error?: string;
  /** Empty string. */
  body?: string;
  /** Long description of error. */
  errors?: string;
}

export class SdApiError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly options: RequestInit | undefined,
    public readonly statusCode: number,
    public readonly statusText: string,
    public readonly response?: SdErrorResponse,
  ) {
    let message = `${options?.method ?? "GET"} ${endpoint} : ${statusCode} ${statusText}`;
    if (response?.error) {
      message += `: ${response.error}`;
      if (response.errors) message += ` - ${response.errors}`;
    } else if (typeof response?.detail === "string" && response.detail.length > 0) {
      message += `: ${response.detail}`;
    } else if (response?.detail) {
      message += `: ${JSON.stringify(response.detail)}`;
    }
    super(message);
  }
}

export function getPngInfo(pngData: Uint8Array): string | undefined {
  return PngChunksExtract.default(pngData)
    .filter((chunk) => chunk.name === "tEXt")
    .map((chunk) => PngChunkText.decode(chunk.data))
    .find((textChunk) => textChunk.keyword === "parameters")
    ?.text;
}

export function parsePngInfo(pngInfo: string): Partial<SdTxt2ImgRequest> {
  const tags = pngInfo.split(/[,;]+|\.+\s|\n/u);
  let part: "prompt" | "negative_prompt" | "params" = "prompt";
  const params: Partial<SdTxt2ImgRequest> = {};
  const prompt: string[] = [];
  const negativePrompt: string[] = [];
  for (const tag of tags) {
    const paramValuePair = tag.trim().match(/^(\w+\s*\w*):\s+([\d\w. ]+)\s*$/u);
    if (paramValuePair) {
      const [, param, value] = paramValuePair;
      switch (param.replace(/\s+/u, "").toLowerCase()) {
        case "prompt":
          part = "prompt";
          prompt.push(value.trim());
          break;
        case "negativeprompt":
          part = "negative_prompt";
          negativePrompt.push(value.trim());
          break;
        case "steps":
        case "cycles": {
          part = "params";
          const steps = Number(value.trim());
          if (steps > 0) params.steps = Math.min(steps, 50);
          break;
        }
        case "cfgscale":
        case "detail": {
          part = "params";
          const cfgScale = Number(value.trim());
          if (cfgScale > 0) params.cfg_scale = Math.min(cfgScale, 20);
          break;
        }
        case "size":
        case "resolution": {
          part = "params";
          const [width, height] = value.trim()
            .split(/\s*[x,]\s*/u, 2)
            .map((v) => v.trim())
            .map(Number);
          if (width > 0 && height > 0) {
            params.width = Math.min(width, 2048);
            params.height = Math.min(height, 2048);
          }
          break;
        }
        default:
          break;
      }
    } else if (tag.trim().length > 0) {
      switch (part) {
        case "prompt":
          prompt.push(tag.trim());
          break;
        case "negative_prompt":
          negativePrompt.push(tag.trim());
          break;
        default:
          break;
      }
    }
  }
  if (prompt.length > 0) params.prompt = prompt.join(", ");
  if (negativePrompt.length > 0) params.negative_prompt = negativePrompt.join(", ");
  return params;
}
