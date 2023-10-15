import { subMinutes } from "date-fns";
import { Model } from "indexed_kv";
import createOpenApiFetch from "openapi_fetch";
import { info } from "std/log/mod.ts";
import { createEndpoint, createMethodFilter, createPathFilter } from "t_rest/server";
import { getConfig } from "../app/config.ts";
import { activeGenerationWorkers } from "../app/generationQueue.ts";
import { generationStore } from "../app/generationStore.ts";
import * as SdApi from "../app/sdApi.ts";
import { WorkerInstance, workerInstanceStore } from "../app/workerInstanceStore.ts";
import { bot } from "../bot/mod.ts";
import { getAuthHeader } from "../utils/getAuthHeader.ts";
import { sessions } from "./sessionsRoute.ts";

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
          schema: {
            type: "object",
            properties: {
              key: { type: "string" },
              name: { type: ["string", "null"] },
              sdUrl: { type: "string" },
              sdAuth: {
                type: ["object", "null"],
                properties: {
                  user: { type: "string" },
                  password: { type: "string" },
                },
                required: ["user", "password"],
              },
            },
            required: ["key", "name", "sdUrl", "sdAuth"],
          },
        },
      },
      async ({ query, body }) => {
        const session = sessions.get(query.sessionId);
        if (!session?.userId) {
          return { status: 401, body: { type: "text/plain", data: "Must be logged in" } };
        }
        const chat = await bot.api.getChat(session.userId);
        if (chat.type !== "private") throw new Error("Chat is not private");
        if (!chat.username) {
          return { status: 403, body: { type: "text/plain", data: "Must have a username" } };
        }
        const config = await getConfig();
        if (!config?.adminUsernames?.includes(chat.username)) {
          return { status: 403, body: { type: "text/plain", data: "Must be an admin" } };
        }
        const workerInstance = await workerInstanceStore.create({
          key: body.data.key,
          name: body.data.name,
          sdUrl: body.data.sdUrl,
          sdAuth: body.data.sdAuth,
        });
        info(`User ${chat.username} created worker ${workerInstance.id}`);
        const worker = await getWorkerData(workerInstance);
        return {
          status: 200,
          body: { type: "application/json", data: worker satisfies WorkerData },
        };
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
          const worker: WorkerData = await getWorkerData(workerInstance);
          return {
            status: 200,
            body: { type: "application/json", data: worker satisfies WorkerData },
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
            schema: {
              type: "object",
              properties: {
                key: { type: "string" },
                name: { type: ["string", "null"] },
                sdUrl: { type: "string" },
                auth: {
                  type: ["object", "null"],
                  properties: {
                    user: { type: "string" },
                    password: { type: "string" },
                  },
                  required: ["user", "password"],
                },
              },
            },
          },
        },
        async ({ params, query, body }) => {
          const workerInstance = await workerInstanceStore.getById(params.workerId);
          if (!workerInstance) {
            return { status: 404, body: { type: "text/plain", data: `Worker not found` } };
          }
          const session = sessions.get(query.sessionId);
          if (!session?.userId) {
            return { status: 401, body: { type: "text/plain", data: "Must be logged in" } };
          }
          const chat = await bot.api.getChat(session.userId);
          if (chat.type !== "private") throw new Error("Chat is not private");
          if (!chat.username) {
            return { status: 403, body: { type: "text/plain", data: "Must have a username" } };
          }
          const config = await getConfig();
          if (!config?.adminUsernames?.includes(chat.username)) {
            return { status: 403, body: { type: "text/plain", data: "Must be an admin" } };
          }
          if (body.data.name !== undefined) {
            workerInstance.value.name = body.data.name;
          }
          if (body.data.sdUrl !== undefined) {
            workerInstance.value.sdUrl = body.data.sdUrl;
          }
          if (body.data.auth !== undefined) {
            workerInstance.value.sdAuth = body.data.auth;
          }
          info(
            `User ${chat.username} updated worker ${params.workerId}: ${JSON.stringify(body.data)}`,
          );
          await workerInstance.update();
          const worker = await getWorkerData(workerInstance);
          return {
            status: 200,
            body: { type: "application/json", data: worker satisfies WorkerData },
          };
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
          const session = sessions.get(query.sessionId);
          if (!session?.userId) {
            return { status: 401, body: { type: "text/plain", data: "Must be logged in" } };
          }
          const chat = await bot.api.getChat(session.userId);
          if (chat.type !== "private") throw new Error("Chat is not private");
          if (!chat.username) {
            return { status: 403, body: { type: "text/plain", data: "Must have a username" } };
          }
          const config = await getConfig();
          if (!config?.adminUsernames?.includes(chat.username)) {
            return { status: 403, body: { type: "text/plain", data: "Must be an admin" } };
          }
          info(`User ${chat.username} deleted worker ${params.workerId}`);
          await workerInstance.delete();
          return { status: 200, body: { type: "application/json", data: null } };
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
