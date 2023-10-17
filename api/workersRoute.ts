import { subMinutes } from "date-fns";
import { Model } from "indexed_kv";
import createOpenApiFetch from "openapi_fetch";
import { info } from "std/log/mod.ts";
import { createEndpoint, createMethodFilter, createPathFilter } from "t_rest/server";
import { activeGenerationWorkers } from "../app/generationQueue.ts";
import { generationStore } from "../app/generationStore.ts";
import * as SdApi from "../app/sdApi.ts";
import {
  WorkerInstance,
  workerInstanceSchema,
  workerInstanceStore,
} from "../app/workerInstanceStore.ts";
import { getAuthHeader } from "../utils/getAuthHeader.ts";
import { withUser } from "./withUser.ts";

export type WorkerData = Omit<WorkerInstance, "sdUrl" | "sdAuth"> & {
  id: string;
  isActive: boolean;
  imagesPerMinute: number;
  stepsPerMinute: number;
  pixelsPerMinute: number;
  pixelStepsPerMinute: number;
};

const STATS_INTERVAL_MIN = 10;

async function getWorkerData(workerInstance: Model<WorkerInstance>): Promise<WorkerData> {
  const after = subMinutes(new Date(), STATS_INTERVAL_MIN);

  const generations = await generationStore.getBy("workerInstanceKey", {
    value: workerInstance.value.key,
    after: after,
  });

  const imagesPerMinute = generations.length / STATS_INTERVAL_MIN;

  const stepsPerMinute = generations
    .map((generation) => generation.value.info?.steps ?? 0)
    .reduce((sum, steps) => sum + steps, 0) / STATS_INTERVAL_MIN;

  const pixelsPerMinute = generations
    .map((generation) => (generation.value.info?.width ?? 0) * (generation.value.info?.height ?? 0))
    .reduce((sum, pixels) => sum + pixels, 0) / STATS_INTERVAL_MIN;

  const pixelStepsPerMinute = generations
    .map((generation) =>
      (generation.value.info?.width ?? 0) * (generation.value.info?.height ?? 0) *
      (generation.value.info?.steps ?? 0)
    )
    .reduce((sum, pixelSteps) => sum + pixelSteps, 0) / STATS_INTERVAL_MIN;

  return {
    id: workerInstance.id,
    key: workerInstance.value.key,
    name: workerInstance.value.name,
    lastError: workerInstance.value.lastError,
    lastOnlineTime: workerInstance.value.lastOnlineTime,
    isActive: activeGenerationWorkers.get(workerInstance.id)?.isProcessing ?? false,
    imagesPerMinute,
    stepsPerMinute,
    pixelsPerMinute,
    pixelStepsPerMinute,
  };
}

export const workersRoute = createPathFilter({
  "": createMethodFilter({
    GET: createEndpoint(
      { query: null, body: null },
      async () => {
        const workerInstances = await workerInstanceStore.getAll();
        const workers = await Promise.all(workerInstances.map(getWorkerData));
        return {
          status: 200,
          body: { type: "application/json", data: workers satisfies WorkerData[] },
        };
      },
    ),
    POST: createEndpoint(
      {
        query: {
          sessionId: { type: "string" },
        },
        body: {
          type: "application/json",
          schema: workerInstanceSchema,
        },
      },
      async ({ query, body }) => {
        return withUser(query, async (chat) => {
          const workerInstance = await workerInstanceStore.create(body.data);
          info(`User ${chat.username} created worker ${workerInstance.id}`);
          return {
            status: 200,
            body: { type: "application/json", data: await getWorkerData(workerInstance) },
          };
        }, { admin: true });
      },
    ),
  }),

  "{workerId}": createPathFilter({
    "": createMethodFilter({
      GET: createEndpoint(
        { query: null, body: null },
        async ({ params }) => {
          const workerInstance = await workerInstanceStore.getById(params.workerId);
          if (!workerInstance) {
            return { status: 404, body: { type: "text/plain", data: `Worker not found` } };
          }
          return {
            status: 200,
            body: { type: "application/json", data: await getWorkerData(workerInstance) },
          };
        },
      ),
      PATCH: createEndpoint(
        {
          query: {
            sessionId: { type: "string" },
          },
          body: {
            type: "application/json",
            schema: { ...workerInstanceSchema, required: [] },
          },
        },
        async ({ params, query, body }) => {
          const workerInstance = await workerInstanceStore.getById(params.workerId);
          if (!workerInstance) {
            return { status: 404, body: { type: "text/plain", data: `Worker not found` } };
          }
          return withUser(query, async (chat) => {
            info(
              `User ${chat.username} updated worker ${params.workerId}: ${
                JSON.stringify(body.data)
              }`,
            );
            await workerInstance.update(body.data);
            return {
              status: 200,
              body: { type: "application/json", data: await getWorkerData(workerInstance) },
            };
          }, { admin: true });
        },
      ),
      DELETE: createEndpoint(
        {
          query: {
            sessionId: { type: "string" },
          },
          body: null,
        },
        async ({ params, query }) => {
          const workerInstance = await workerInstanceStore.getById(params.workerId);
          if (!workerInstance) {
            return { status: 404, body: { type: "text/plain", data: `Worker not found` } };
          }
          return withUser(query, async (chat) => {
            info(`User ${chat.username} deleted worker ${params.workerId}`);
            await workerInstance.delete();
            return { status: 200, body: { type: "application/json", data: null } };
          }, { admin: true });
        },
      ),
    }),

    "loras": createMethodFilter({
      GET: createEndpoint(
        { query: null, body: null },
        async ({ params }) => {
          const workerInstance = await workerInstanceStore.getById(params.workerId);
          if (!workerInstance) {
            return { status: 404, body: { type: "text/plain", data: `Worker not found` } };
          }
          const sdClient = createOpenApiFetch<SdApi.paths>({
            baseUrl: workerInstance.value.sdUrl,
            headers: getAuthHeader(workerInstance.value.sdAuth),
          });
          const lorasResponse = await sdClient.GET("/sdapi/v1/loras", {});
          if (lorasResponse.error) {
            return {
              status: 500,
              body: { type: "text/plain", data: `Loras request failed: ${lorasResponse["error"]}` },
            };
          }
          const loras = (lorasResponse.data as Lora[]).map((lora) => ({
            name: lora.name,
            alias: lora.alias ?? null,
          }));
          return {
            status: 200,
            body: { type: "application/json", data: loras },
          };
        },
      ),
    }),

    "models": createMethodFilter({
      GET: createEndpoint(
        { query: null, body: null },
        async ({ params }) => {
          const workerInstance = await workerInstanceStore.getById(params.workerId);
          if (!workerInstance) {
            return { status: 404, body: { type: "text/plain", data: `Worker not found` } };
          }
          const sdClient = createOpenApiFetch<SdApi.paths>({
            baseUrl: workerInstance.value.sdUrl,
            headers: getAuthHeader(workerInstance.value.sdAuth),
          });
          const modelsResponse = await sdClient.GET("/sdapi/v1/sd-models", {});
          if (modelsResponse.error) {
            return {
              status: 500,
              body: {
                type: "text/plain",
                data: `Models request failed: ${modelsResponse["error"]}`,
              },
            };
          }
          const models = modelsResponse.data.map((model) => ({
            title: model.title,
            modelName: model.model_name,
            hash: model.hash,
            sha256: model.sha256,
          }));
          return {
            status: 200,
            body: { type: "application/json", data: models },
          };
        },
      ),
    }),
  }),
});

export interface Lora {
  name: string;
  alias: string | null;
  metadata: object;
}
