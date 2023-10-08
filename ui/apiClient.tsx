import { createFetcher, Output } from "t_rest/client";
import { ApiHandler } from "../api/serveApi.ts";

export const fetchApi = createFetcher<ApiHandler>({
  baseUrl: `${location.origin}/api/`,
});

export function handleResponse<T extends Output>(
  response: T,
): (T & { status: 200 })["body"]["data"] {
  if (response.status !== 200) {
    throw new Error(String(response.body.data));
  }
  return response.body.data;
}
