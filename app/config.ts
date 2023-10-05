import { db } from "./db.ts";
import { JsonSchema, jsonType } from "t_rest/server";

export const configSchema = {
  type: "object",
  properties: {
    adminUsernames: { type: "array", items: { type: "string" } },
    pausedReason: { type: ["string", "null"] },
    maxUserJobs: { type: "number" },
    maxJobs: { type: "number" },
    defaultParams: {
      type: "object",
      properties: {
        batch_size: { type: "number" },
        n_iter: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        steps: { type: "number" },
        cfg_scale: { type: "number" },
        sampler_name: { type: "string" },
        negative_prompt: { type: "string" },
      },
    },
    sdInstances: {
      type: "object",
      additionalProperties: {
        type: "object",
        properties: {
          name: { type: "string" },
          api: {
            type: "object",
            properties: {
              url: { type: "string" },
              auth: { type: "string" },
            },
            required: ["url"],
          },
          maxResolution: { type: "number" },
        },
        required: ["api", "maxResolution"],
      },
    },
  },
  required: ["adminUsernames", "maxUserJobs", "maxJobs", "defaultParams", "sdInstances"],
} as const satisfies JsonSchema;

export type Config = jsonType<typeof configSchema>;

export async function getConfig(): Promise<Config> {
  const configEntry = await db.get<Config>(["config"]);
  const config = configEntry?.value;
  return {
    adminUsernames: config?.adminUsernames ?? [],
    pausedReason: config?.pausedReason ?? null,
    maxUserJobs: config?.maxUserJobs ?? Infinity,
    maxJobs: config?.maxJobs ?? Infinity,
    defaultParams: config?.defaultParams ?? {},
    sdInstances: config?.sdInstances ?? {},
  };
}

export async function setConfig(newConfig: Partial<Config>): Promise<void> {
  const oldConfig = await getConfig();
  const config: Config = {
    adminUsernames: newConfig.adminUsernames ?? oldConfig.adminUsernames,
    pausedReason: newConfig.pausedReason ?? oldConfig.pausedReason,
    maxUserJobs: newConfig.maxUserJobs ?? oldConfig.maxUserJobs,
    maxJobs: newConfig.maxJobs ?? oldConfig.maxJobs,
    defaultParams: newConfig.defaultParams ?? oldConfig.defaultParams,
    sdInstances: newConfig.sdInstances ?? oldConfig.sdInstances,
  };
  await db.set(["config"], config);
}
