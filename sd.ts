export async function txt2img(
  apiUrl: string,
  params: Partial<SdTxt2ImgRequest>,
  onProgress?: (progress: SdProgressResponse) => void,
  signal?: AbortSignal,
): Promise<SdTxt2ImgResponse> {
  let response: Response | undefined;
  let error: unknown;

  fetch(new URL("sdapi/v1/txt2img", apiUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then(
    (resp) => (response = resp),
    (err) => (error = err),
  );

  try {
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const progressRequest = await fetch(new URL("sdapi/v1/progress", apiUrl));
      if (progressRequest.ok) {
        const progress = (await progressRequest.json()) as SdProgressResponse;
        onProgress?.(progress);
      }
      if (response != null) {
        if (response.ok) {
          const result = (await response.json()) as SdTxt2ImgResponse;
          return result;
        } else {
          throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }
      }
      if (error != null) {
        throw error;
      }
      signal?.throwIfAborted();
    }
  } finally {
    if (!response && !error) {
      await fetch(new URL("sdapi/v1/interrupt", apiUrl), { method: "POST" });
    }
  }
}

export interface SdTxt2ImgRequest {
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

export interface SdTxt2ImgResponse {
  images: string[];
  parameters: SdTxt2ImgRequest;
  /** Contains serialized JSON */
  info: string;
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
