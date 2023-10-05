import { Client } from "t_rest/client";
import { ApiResponse } from "t_rest/server";
import { ErisApi } from "../api/api.ts";

export const apiClient = new Client<ErisApi>(`${location.origin}/api/`);

export function handleResponse<T extends ApiResponse>(response: T): (T & { status: 200 })["body"] {
  if (response.status !== 200) {
    throw new Error(String(response.body));
  }
  return response.body;
}
