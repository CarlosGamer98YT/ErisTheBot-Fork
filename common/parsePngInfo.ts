import { PngChunksExtract, PngChunkText } from "../deps.ts";

export function getPngInfo(pngData: Uint8Array): string | undefined {
  return PngChunksExtract.default(pngData)
    .filter((chunk) => chunk.name === "tEXt")
    .map((chunk) => PngChunkText.decode(chunk.data))
    .find((textChunk) => textChunk.keyword === "parameters")
    ?.text;
}

export interface PngInfo {
  prompt: string;
  negative_prompt: string;
  steps: number;
  cfg_scale: number;
  width: number;
  height: number;
  sampler_name: string;
  seed: number;
  denoising_strength: number;
}

export function parsePngInfo(pngInfo: string): Partial<PngInfo> {
  const tags = pngInfo.split(/[,;]+|\.+\s|\n/u);
  let part: "prompt" | "negative_prompt" | "params" = "prompt";
  const params: Partial<PngInfo> = {};
  const prompt: string[] = [];
  const negativePrompt: string[] = [];
  for (const tag of tags) {
    const paramValuePair = tag.trim().match(/^(\w+\s*\w*):\s+(.*)$/u);
    if (paramValuePair) {
      const [, param, value] = paramValuePair;
      switch (param.replace(/\s+/u, "").toLowerCase()) {
        case "positiveprompt":
        case "positive":
        case "prompt":
        case "pos":
          part = "prompt";
          prompt.push(value.trim());
          break;
        case "negativeprompt":
        case "negative":
        case "neg":
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
        case "cfg":
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
        case "denoisingstrength":
        case "denoising":
        case "denoise": {
          part = "params";
          // allow percent or decimal
          let denoisingStrength: number;
          if (value.trim().endsWith("%")) {
            denoisingStrength = Number(value.trim().slice(0, -1).trim()) / 100;
          } else {
            denoisingStrength = Number(value.trim());
          }
          denoisingStrength = Math.min(Math.max(denoisingStrength, 0), 1);
          params.denoising_strength = denoisingStrength;
          break;
        }
        case "seed":
        case "model":
        case "modelhash":
        case "modelname":
        case "sampler":
          part = "params";
          // ignore for now
          break;
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
