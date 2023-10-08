import { cx } from "@twind/core";
import React, { ReactNode, useState } from "react";
import useSWR from "swr";
import { fetchApi, handleResponse } from "./apiClient.tsx";

export function SettingsPage(props: { sessionId: string }) {
  const { sessionId } = props;
  const session = useSWR(
    sessionId ? ["sessions/{sessionId}", "GET", { params: { sessionId } }] as const : null,
    (args) => fetchApi(...args).then(handleResponse),
  );
  const user = useSWR(
    session.data?.userId
      ? ["users/{userId}", "GET", { params: { userId: String(session.data.userId) } }] as const
      : null,
    (args) => fetchApi(...args).then(handleResponse),
  );
  const params = useSWR(
    ["settings/params", "GET", {}] as const,
    (args) => fetchApi(...args).then(handleResponse),
  );
  const [changedParams, setChangedParams] = useState<Partial<typeof params.data>>({});
  const [error, setError] = useState<string>();

  return (
    <form
      className="flex flex-col items-stretch gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        params.mutate(() =>
          fetchApi("settings/params", "PATCH", {
            query: { sessionId },
            body: { type: "application/json", data: changedParams ?? {} },
          }).then(handleResponse)
        )
          .then(() => setChangedParams({}))
          .catch((e) => setError(String(e)));
      }}
    >
      <label className="flex flex-col items-stretch gap-1">
        <span className="text-sm">
          Negative prompt {changedParams?.negative_prompt != null ? "(Changed)" : ""}
        </span>
        <textarea
          className="input-text"
          disabled={params.isLoading || !user.data?.isAdmin}
          value={changedParams?.negative_prompt ??
            params.data?.negative_prompt ??
            ""}
          onChange={(e) =>
            setChangedParams((params) => ({
              ...params,
              negative_prompt: e.target.value,
            }))}
        />
      </label>
      <label className="flex flex-col items-stretch gap-1">
        <span className="text-sm">
          Steps {changedParams?.steps != null ? "(Changed)" : ""}
        </span>
        <span className="flex items-center gap-1">
          <input
            className="input-text w-20"
            type="number"
            min={5}
            max={50}
            step={5}
            disabled={params.isLoading || !user.data?.isAdmin}
            value={changedParams?.steps ??
              params.data?.steps ??
              0}
            onChange={(e) =>
              setChangedParams((params) => ({
                ...params,
                steps: Number(e.target.value),
              }))}
          />
          <input
            className="input-range flex-grow"
            type="range"
            min={5}
            max={50}
            step={5}
            disabled={params.isLoading || !user.data?.isAdmin}
            value={changedParams?.steps ??
              params.data?.steps ??
              0}
            onChange={(e) =>
              setChangedParams((params) => ({
                ...params,
                steps: Number(e.target.value),
              }))}
          />
        </span>
      </label>
      <label className="flex flex-col items-stretch gap-1">
        <span className="text-sm">
          Detail {changedParams?.cfg_scale != null ? "(Changed)" : ""}
        </span>
        <span className="flex items-center gap-1">
          <input
            className="input-text w-20"
            type="number"
            min={1}
            max={20}
            step={1}
            disabled={params.isLoading || !user.data?.isAdmin}
            value={changedParams?.cfg_scale ??
              params.data?.cfg_scale ??
              0}
            onChange={(e) =>
              setChangedParams((params) => ({
                ...params,
                cfg_scale: Number(e.target.value),
              }))}
          />
          <input
            className="input-range flex-grow"
            type="range"
            min={1}
            max={20}
            step={1}
            disabled={params.isLoading || !user.data?.isAdmin}
            value={changedParams?.cfg_scale ??
              params.data?.cfg_scale ??
              0}
            onChange={(e) =>
              setChangedParams((params) => ({
                ...params,
                cfg_scale: Number(e.target.value),
              }))}
          />
        </span>
      </label>
      <div className="flex gap-4">
        <label className="flex flex-1 flex-col items-stretch gap-1">
          <span className="text-sm">
            Width {changedParams?.width != null ? "(Changed)" : ""}
          </span>
          <input
            className="input-text"
            type="number"
            min={64}
            max={2048}
            step={64}
            disabled={params.isLoading || !user.data?.isAdmin}
            value={changedParams?.width ??
              params.data?.width ??
              0}
            onChange={(e) =>
              setChangedParams((params) => ({
                ...params,
                width: Number(e.target.value),
              }))}
          />
          <input
            className="input-range"
            type="range"
            min={64}
            max={2048}
            step={64}
            disabled={params.isLoading || !user.data?.isAdmin}
            value={changedParams?.width ??
              params.data?.width ??
              0}
            onChange={(e) =>
              setChangedParams((params) => ({
                ...params,
                width: Number(e.target.value),
              }))}
          />
        </label>
        <label className="flex flex-1 flex-col items-stretch gap-1">
          <span className="text-sm">
            Height {changedParams?.height != null ? "(Changed)" : ""}
          </span>
          <input
            className="input-text"
            type="number"
            min={64}
            max={2048}
            step={64}
            disabled={params.isLoading || !user.data?.isAdmin}
            value={changedParams?.height ??
              params.data?.height ??
              0}
            onChange={(e) =>
              setChangedParams((params) => ({
                ...params,
                height: Number(e.target.value),
              }))}
          />
          <input
            className="input-range"
            type="range"
            min={64}
            max={2048}
            step={64}
            disabled={params.isLoading || !user.data?.isAdmin}
            value={changedParams?.height ??
              params.data?.height ??
              0}
            onChange={(e) =>
              setChangedParams((params) => ({
                ...params,
                height: Number(e.target.value),
              }))}
          />
        </label>
      </div>
      {error ? <Alert onClose={() => setError(undefined)}>{error}</Alert> : null}
      {params.error ? <Alert>{params.error.message}</Alert> : null}
      <div className="flex gap-2 items-center justify-end">
        <button
          type="button"
          className={cx("button-outlined ripple", params.isLoading && "bg-stripes")}
          disabled={params.isLoading || !user.data?.isAdmin ||
            Object.keys(changedParams ?? {}).length === 0}
          onClick={() => setChangedParams({})}
        >
          Reset
        </button>
        <button
          type="submit"
          className={cx("button-filled ripple", params.isLoading && "bg-stripes")}
          disabled={params.isLoading || !user.data?.isAdmin ||
            Object.keys(changedParams ?? {}).length === 0}
        >
          Save
        </button>
      </div>
    </form>
  );
}

function Alert(props: { children: ReactNode; onClose?: () => void }) {
  const { children, onClose } = props;
  return (
    <p
      role="alert"
      className="px-4 py-2 flex gap-2 items-center bg-red-500 text-white rounded-sm shadow-md"
    >
      <span className="flex-grow">{children}</span>
      {onClose
        ? (
          <button
            type="button"
            className="button-ghost"
            onClick={() => onClose()}
          >
            Close
          </button>
        )
        : null}
    </p>
  );
}
