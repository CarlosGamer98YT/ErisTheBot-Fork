import * as SdApi from "../sd/sdApi.ts";
import { db } from "./db.ts";

export interface ConfigData {
  adminUsernames: string[];
  pausedReason: string | null;
  maxUserJobs: number;
  maxJobs: number;
  defaultParams?: Partial<
    | SdApi.components["schemas"]["StableDiffusionProcessingTxt2Img"]
    | SdApi.components["schemas"]["StableDiffusionProcessingImg2Img"]
  >;
  sdInstances: SdInstanceData[];
}

export interface SdInstanceData {
  id: string;
  name?: string;
  api: { url: string; auth?: string };
  maxResolution: number;
}

const getDefaultConfig = (): ConfigData => ({
  adminUsernames: Deno.env.get("TG_ADMIN_USERS")?.split(",") ?? [],
  pausedReason: null,
  maxUserJobs: 3,
  maxJobs: 20,
  defaultParams: {
    batch_size: 1,
    n_iter: 1,
    width: 512,
    height: 768,
    steps: 30,
    cfg_scale: 10,
    negative_prompt: "boring_e621_fluffyrock_v4 boring_e621_v4",
  },
  sdInstances: [
    {
      id: "local",
      api: { url: Deno.env.get("SD_API_URL") ?? "http://127.0.0.1:7860/" },
      maxResolution: 1024 * 1024,
    },
  ],
});

export async function getConfig(): Promise<ConfigData> {
  const configEntry = await db.get<ConfigData>(["config"]);
  return configEntry.value ?? getDefaultConfig();
}

export async function setConfig(config: ConfigData): Promise<void> {
  await db.set(["config"], config);
}
