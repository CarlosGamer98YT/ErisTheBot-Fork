import { GrammyTypes, IKV } from "../deps.ts";
import { db } from "./db.ts";

export interface GenerationSchema {
  from: GrammyTypes.User;
  chat: GrammyTypes.Chat;
  sdInstanceId?: string;
  info?: SdGenerationInfo;
  startDate?: Date;
  endDate?: Date;
}

/**
 * `info` field in generation response is a serialized json string of this shape.
 */
export interface SdGenerationInfo {
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
  extra_generation_params: Record<string, string>;
  index_of_first_image: number;
  infotexts: string[];
  styles: unknown[];
  job_timestamp: string;
  clip_skip: number;
  is_using_inpainting_conditioning: boolean;
}

type GenerationIndices = {
  fromId: number;
  chatId: number;
};

export const generationStore = new IKV.Store<GenerationSchema, GenerationIndices>(
  db,
  "generations",
  {
    indices: {
      fromId: { getValue: (item) => item.from.id },
      chatId: { getValue: (item) => item.chat.id },
    },
  },
);
