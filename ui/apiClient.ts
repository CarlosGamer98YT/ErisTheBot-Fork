import { edenFetch } from "elysia/eden";
import { Api } from "../api/serveApi.ts";

export const API_URL = "/api";

export const fetchApi = edenFetch<Api>(API_URL);

export function handleResponse<
  T extends
    | { data: unknown; error: null }
    | { data: null; error: { status: number; value: unknown } },
>(
  response: T,
): (T & { error: null })["data"] {
  if (response.error) {
    throw new Error(`${response.error?.status}: ${response.error?.value}`);
  }
  return response.data;
}
