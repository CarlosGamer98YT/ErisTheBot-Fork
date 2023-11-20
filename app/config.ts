import { Static, t } from "elysia";
import { Tkv } from "../utils/Tkv.ts";
import { db } from "./db.ts";

export const defaultParamsSchema = t.Partial(t.Object({
  batch_size: t.Number(),
  n_iter: t.Number(),
  width: t.Number(),
  height: t.Number(),
  steps: t.Number(),
  cfg_scale: t.Number(),
  sampler_name: t.String(),
  negative_prompt: t.String(),
}));

export type DefaultParams = Static<typeof defaultParamsSchema>;

export const configSchema = t.Object({
  pausedReason: t.Nullable(t.String()),
  maxUserJobs: t.Number(),
  maxJobs: t.Number(),
  defaultParams: defaultParamsSchema,
});

export type Config = Static<typeof configSchema>;

export const configStore = new Tkv<["config"], Config>(db);

const defaultConfig: Config = {
  pausedReason: null,
  maxUserJobs: Infinity,
  maxJobs: Infinity,
  defaultParams: {},
};

export async function getConfig(): Promise<Config> {
  const configEntry = await configStore.get(["config"]);
  return { ...defaultConfig, ...configEntry.value };
}

export async function setConfig<K extends keyof Config>(newConfig: Pick<Config, K>): Promise<void> {
  const configEntry = await configStore.get(["config"]);
  const config = { ...defaultConfig, ...configEntry.value, ...newConfig };
  await configStore.atomicSet(["config"], configEntry.versionstamp, config);
}
