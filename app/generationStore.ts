import { Chat, User } from "grammy_types";
import { Store } from "indexed_kv";
import { db } from "./db.ts";

export interface GenerationSchema {
  from: User;
  chat: Chat;
  sdInstanceId?: string; // TODO: change to workerInstanceKey
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
  workerInstanceKey: string;
};

export const generationStore = new Store<GenerationSchema, GenerationIndices>(
  db,
  "generations",
  {
    indices: {
      fromId: { getValue: (item) => item.from.id },
      chatId: { getValue: (item) => item.chat.id },
      workerInstanceKey: { getValue: (item) => item.sdInstanceId ?? "" },
    },
  },
);
