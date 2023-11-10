import * as ExifReader from "exifreader";

export function getPngInfo(pngData: ArrayBuffer): string | undefined {
  const image = ExifReader.load(pngData);

  if (image.UserComment && image.UserComment.value) {
    // JPEG image
    return String.fromCharCode.apply(
      0,
      (image.UserComment.value as number[]).filter((char: number) => char != 0),
    )
      .replace("UNICODE", "");
  } else if (image.parameters && image.parameters.description) {
    // PNG image
    return image.parameters.description;
  } else {
    // Unknown image type
    return undefined;
  }
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

interface PngInfoExtra extends PngInfo {
  upscale?: number;
}

export function parsePngInfo(
  pngInfo: string,
  baseParams?: Partial<PngInfo>,
  shouldParseSeed?: boolean,
): Partial<PngInfo> {
  const tags = pngInfo.split(/[,;]+|\.+\s|\n/u);
  let part: "prompt" | "negative_prompt" | "params" = "prompt";
  const params: Partial<PngInfoExtra> = {};
  const prompt: string[] = [];
  const negativePrompt: string[] = [];
  for (const tag of tags) {
    const paramValuePair = tag.trim().match(/^(\w+\s*\w*):\s+(.*)$/u);
    if (paramValuePair) {
      const [_match, param = "", value = ""] = paramValuePair;
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
          const [width = 0, height = 0] = value.trim()
            .split(/\s*[x,]\s*/u, 2)
            .map((v) => v.trim())
            .map(Number);
          if (width > 0 && height > 0) {
            params.width = Math.min(width, 2048);
            params.height = Math.min(height, 2048);
          }
          break;
        }
        case "upscale":
        case "scale": {
          part = "params";
          const upscale = Number(value.trim());
          if (upscale > 0) params.upscale = Math.min(upscale, 2);
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
        case "seed": {
          part = "params";
          if (shouldParseSeed) {
            const seed = Number(value.trim());
            if (Number.isFinite(seed)) {
              params.seed = seed;
            }
          }
          break;
        }
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

  // handle upscale
  if (params.upscale && baseParams?.width && baseParams?.height) {
    params.width = baseParams.width * params.upscale;
    params.height = baseParams.height * params.upscale;
  }

  return {
    ...baseParams,
    ...params,
    prompt: [baseParams?.prompt, params.prompt]
      .filter(Boolean).join("\n"),
    negative_prompt: [baseParams?.negative_prompt, params.negative_prompt]
      .filter(Boolean).join("\n"),
  };
}
