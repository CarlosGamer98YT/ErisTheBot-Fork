import { createEndpoint, createMethodFilter, createPathFilter } from "t_rest/server";
import { activeGenerationWorkers } from "../app/generationQueue.ts";
import { getConfig } from "../app/config.ts";
import * as SdApi from "../app/sdApi.ts";
import createOpenApiFetch from "openapi_fetch";

export const workersRoute = createPathFilter({
  "": createMethodFilter({
    "GET": createEndpoint(
      { query: null, body: null },
      async () => {
        const activeWorkers = activeGenerationWorkers;
        const { sdInstances } = await getConfig();

        const workers = Object.entries(sdInstances).map(([sdInstanceId, sdInstance]) => ({
          id: sdInstanceId,
          name: sdInstance.name ?? sdInstanceId,
          maxResolution: sdInstance.maxResolution,
          active: activeWorkers.has(sdInstanceId),
          lastOnline: null,
          imagesPerMinute: null,
          pixelsPerSecond: null,
          pixelStepsPerSecond: null,
        }));

        return {
          status: 200,
          body: { type: "application/json", data: workers },
        };
      },
    ),
  }),

  "{workerId}/loras": createMethodFilter({
    GET: createEndpoint(
      { query: null, body: null },
      async ({ params }) => {
        const { sdInstances } = await getConfig();
        const sdInstance = sdInstances[params.workerId];
        if (!sdInstance) {
          return { status: 404, body: { type: "text/plain", data: `Worker not found` } };
        }
        const sdClient = createOpenApiFetch<SdApi.paths>({ baseUrl: sdInstance.api.url });
        const lorasResponse = await sdClient.GET("/sdapi/v1/loras", {
          headers: sdInstance.api.auth ? { Authorization: sdInstance.api.auth } : undefined,
        });
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

  "{workerId}/models": createMethodFilter({
    GET: createEndpoint(
      { query: null, body: null },
      async ({ params }) => {
        const { sdInstances } = await getConfig();
        const sdInstance = sdInstances[params.workerId];
        if (!sdInstance) {
          return { status: 404, body: { type: "text/plain", data: `Worker not found` } };
        }
        const sdClient = createOpenApiFetch<SdApi.paths>({ baseUrl: sdInstance.api.url });
        const modelsResponse = await sdClient.GET("/sdapi/v1/sd-models", {
          headers: sdInstance.api.auth ? { Authorization: sdInstance.api.auth } : undefined,
        });
        if (modelsResponse.error) {
          return {
            status: 500,
            body: { type: "text/plain", data: `Models request failed: ${modelsResponse["error"]}` },
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
});

export interface Lora {
  name: string;
  alias: string | null;
  metadata: object;
}
