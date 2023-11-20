import { subMinutes } from "date-fns";
import { Model } from "indexed_kv";
import createOpenApiFetch from "openapi_fetch";
import { info } from "std/log/mod.ts";
import { Elysia, NotFoundError, Static, t } from "elysia";
import { activeGenerationWorkers } from "../app/generationQueue.ts";
import { generationStore } from "../app/generationStore.ts";
import * as SdApi from "../app/sdApi.ts";
import {
  WorkerInstance,
  workerInstanceSchema,
  workerInstanceStore,
} from "../app/workerInstanceStore.ts";
import { getAuthHeader } from "../utils/getAuthHeader.ts";
import { omitUndef } from "../utils/omitUndef.ts";
import { withSessionAdmin } from "./getUser.ts";

const workerResponseSchema = t.Intersect([
  t.Object({ id: t.String() }),
  t.Omit(workerInstanceSchema, ["sdUrl", "sdAuth"]),
  t.Object({
    isActive: t.Boolean(),
    imagesPerMinute: t.Number(),
    stepsPerMinute: t.Number(),
    pixelsPerMinute: t.Number(),
    pixelStepsPerMinute: t.Number(),
  }),
]);

export type WorkerResponse = Static<typeof workerResponseSchema>;

const workerRequestSchema = t.Omit(workerInstanceSchema, ["lastOnlineTime", "lastError"]);

const STATS_INTERVAL_MIN = 10;

async function getWorkerResponse(workerInstance: Model<WorkerInstance>): Promise<WorkerResponse> {
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

  return omitUndef({
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
  });
}

export const workersRoute = new Elysia()
  .get(
    "",
    async () => {
      const workerInstances = await workerInstanceStore.getAll();
      const workers = await Promise.all(workerInstances.map(getWorkerResponse));
      return workers;
    },
    {
      response: t.Array(workerResponseSchema),
    },
  )
  .post(
    "",
    async ({ query, body, set }) => {
      return withSessionAdmin({ query, set }, async (sessionUser) => {
        const workerInstance = await workerInstanceStore.create(body);
        info(`User ${sessionUser.first_name} created worker ${workerInstance.value.name}`);
        return await getWorkerResponse(workerInstance);
      });
    },
    {
      query: t.Object({ sessionId: t.String() }),
      body: workerRequestSchema,
      response: {
        200: workerResponseSchema,
        401: t.Literal("Must be logged in"),
        403: t.Literal("Must be an admin"),
      },
    },
  )
  .get(
    "/:workerId",
    async ({ params }) => {
      const workerInstance = await workerInstanceStore.getById(params.workerId);
      if (!workerInstance) {
        throw new NotFoundError("Worker not found");
      }
      return await getWorkerResponse(workerInstance);
    },
    {
      params: t.Object({ workerId: t.String() }),
      response: {
        200: workerResponseSchema,
      },
    },
  )
  .patch(
    "/:workerId",
    async ({ params, query, body, set }) => {
      const workerInstance = await workerInstanceStore.getById(params.workerId);
      if (!workerInstance) {
        throw new NotFoundError("Worker not found");
      }
      return withSessionAdmin({ query, set }, async (sessionUser) => {
        info(
          `User ${sessionUser.first_name} updated worker ${workerInstance.value.name}: ${
            JSON.stringify(body)
          }`,
        );
        await workerInstance.update(body);
        return await getWorkerResponse(workerInstance);
      });
    },
    {
      params: t.Object({ workerId: t.String() }),
      query: t.Object({ sessionId: t.String() }),
      body: t.Partial(workerRequestSchema),
      response: {
        200: workerResponseSchema,
        401: t.Literal("Must be logged in"),
        403: t.Literal("Must be an admin"),
      },
    },
  )
  .delete(
    "/:workerId",
    async ({ params, query, set }) => {
      const workerInstance = await workerInstanceStore.getById(params.workerId);
      if (!workerInstance) {
        throw new Error("Worker not found");
      }
      return withSessionAdmin({ query, set }, async (sessionUser) => {
        info(`User ${sessionUser.first_name} deleted worker ${workerInstance.value.name}`);
        await workerInstance.delete();
        return null;
      });
    },
    {
      params: t.Object({ workerId: t.String() }),
      query: t.Object({ sessionId: t.String() }),
      response: {
        200: t.Null(),
        401: t.Literal("Must be logged in"),
        403: t.Literal("Must be an admin"),
      },
    },
  )
  .get(
    "/:workerId/loras",
    async ({ params }) => {
      const workerInstance = await workerInstanceStore.getById(params.workerId);
      if (!workerInstance) {
        throw new NotFoundError("Worker not found");
      }
      const sdClient = createOpenApiFetch<SdApi.paths>({
        baseUrl: workerInstance.value.sdUrl,
        headers: getAuthHeader(workerInstance.value.sdAuth),
      });
      const lorasResponse = await sdClient.GET("/sdapi/v1/loras", {});
      if (lorasResponse.error) {
        throw new Error(
          `Loras request failed: ${lorasResponse["error"]}`,
        );
      }
      const loras = (lorasResponse.data as Lora[]).map((lora) => ({
        name: lora.name,
        alias: lora.alias ?? null,
      }));
      return loras;
    },
    {
      params: t.Object({ workerId: t.String() }),
      response: t.Array(
        t.Object({
          name: t.String(),
          alias: t.Nullable(t.String()),
        }),
      ),
    },
  )
  .get(
    "/:workerId/models",
    async ({ params }) => {
      const workerInstance = await workerInstanceStore.getById(params.workerId);
      if (!workerInstance) {
        throw new NotFoundError("Worker not found");
      }
      const sdClient = createOpenApiFetch<SdApi.paths>({
        baseUrl: workerInstance.value.sdUrl,
        headers: getAuthHeader(workerInstance.value.sdAuth),
      });
      const modelsResponse = await sdClient.GET("/sdapi/v1/sd-models", {});
      if (modelsResponse.error) {
        throw new Error(
          `Models request failed: ${modelsResponse["error"]}`,
        );
      }
      const models = modelsResponse.data.map((model) => ({
        title: model.title,
        modelName: model.model_name,
        hash: model.hash ?? null,
        sha256: model.sha256 ?? null,
      }));
      return models;
    },
    {
      params: t.Object({ workerId: t.String() }),
      response: t.Array(
        t.Object({
          title: t.String(),
          modelName: t.String(),
          hash: t.Nullable(t.String()),
          sha256: t.Nullable(t.String()),
        }),
      ),
    },
  );

export interface Lora {
  name: string;
  alias: string | null;
  metadata: object;
}
