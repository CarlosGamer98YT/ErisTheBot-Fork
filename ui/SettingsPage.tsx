import React, { useState } from "react";
import useSWR from "swr";
import { cx } from "twind/core";
import { fetchApi, handleResponse } from "./apiClient.ts";
import { omitUndef } from "../utils/omitUndef.ts";

export function SettingsPage(props: { sessionId: string | null }) {
  const { sessionId } = props;

  const getSession = useSWR(
    sessionId ? ["/sessions/:sessionId", { params: { sessionId } }] as const : null,
    (args) => fetchApi(...args).then(handleResponse),
  );
  const getUser = useSWR(
    getSession.data?.userId
      ? ["/users/:userId", { params: { userId: String( getSession.data.userId) } }] as const
      : null,
    (args) => fetchApi(...args).then(handleResponse),
  );
  const getParams = useSWR(
    ["/settings/params", {}] as const,
    (args) => fetchApi(...args).then(handleResponse),
  );
  const [newParams, setNewParams] = useState<Partial<typeof getParams.data>>({});
  const [patchParamsError, setPatchParamsError] = useState<string>();

  return (
    <form
      className="flex flex-col items-stretch gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        getParams.mutate(() =>
          fetchApi("/settings/params", {
            method: "PATCH",
            query: { sessionId: sessionId ?? "" },
            body: omitUndef(newParams ?? {}),
          }).then(handleResponse)
        )
          .then(() => setNewParams({}))
          .catch((e) => setPatchParamsError(String(e)));
      }}
    >
      <label className="flex flex-col items-stretch gap-1">
        <span className="text-sm">
          Negative prompt {newParams?.negative_prompt != null ? "(Changed)" : ""}
        </span>
        <textarea
          className="input-text"
          disabled={getParams.isLoading || !getUser.data?.admin}
          value={newParams?.negative_prompt ??
            getParams.data?.negative_prompt ??
            ""}
          onChange={(e) =>
            setNewParams((params) => ({
              ...params,
              negative_prompt: e.target.value,
            }))}
        />
      </label>

      <label className="flex flex-col items-stretch gap-1">
        <span className="text-sm">
          Sampler {newParams?.sampler_name != null ? "(Changed)" : ""}
        </span>
        <input
          className="input-text"
          disabled={getParams.isLoading || !getUser.data?.admin}
          value={newParams?.sampler_name ??
            getParams.data?.sampler_name ??
            ""}
          onChange={(e) =>
            setNewParams((params) => ({
              ...params,
              sampler_name: e.target.value,
            }))}
        />
      </label>

      <label className="flex flex-col items-stretch gap-1">
        <span className="text-sm">
          Steps {newParams?.steps != null ? "(Changed)" : ""}
        </span>
        <span className="flex items-center gap-1">
          <input
            className="input-text w-20"
            type="number"
            min={5}
            max={50}
            step={5}
            disabled={getParams.isLoading || !getUser.data?.admin}
            value={newParams?.steps ??
              getParams.data?.steps ??
              0}
            onChange={(e) =>
              setNewParams((params) => ({
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
            disabled={getParams.isLoading || !getUser.data?.admin}
            value={newParams?.steps ??
              getParams.data?.steps ??
              0}
            onChange={(e) =>
              setNewParams((params) => ({
                ...params,
                steps: Number(e.target.value),
              }))}
          />
        </span>
      </label>

      <label className="flex flex-col items-stretch gap-1">
        <span className="text-sm">
          Detail {newParams?.cfg_scale != null ? "(Changed)" : ""}
        </span>
        <span className="flex items-center gap-1">
          <input
            className="input-text w-20"
            type="number"
            min={1}
            max={20}
            step={1}
            disabled={getParams.isLoading || !getUser.data?.admin}
            value={newParams?.cfg_scale ??
              getParams.data?.cfg_scale ??
              0}
            onChange={(e) =>
              setNewParams((params) => ({
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
            disabled={getParams.isLoading || !getUser.data?.admin}
            value={newParams?.cfg_scale ??
              getParams.data?.cfg_scale ??
              0}
            onChange={(e) =>
              setNewParams((params) => ({
                ...params,
                cfg_scale: Number(e.target.value),
              }))}
          />
        </span>
      </label>

      <div className="flex gap-4">
        <label className="flex flex-1 flex-col items-stretch gap-1">
          <span className="text-sm">
            Width {newParams?.width != null ? "(Changed)" : ""}
          </span>
          <input
            className="input-text"
            type="number"
            min={64}
            max={2048}
            step={64}
            disabled={getParams.isLoading || !getUser.data?.admin}
            value={newParams?.width ??
              getParams.data?.width ??
              0}
            onChange={(e) =>
              setNewParams((params) => ({
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
            disabled={getParams.isLoading || !getUser.data?.admin}
            value={newParams?.width ??
              getParams.data?.width ??
              0}
            onChange={(e) =>
              setNewParams((params) => ({
                ...params,
                width: Number(e.target.value),
              }))}
          />
        </label>
        <label className="flex flex-1 flex-col items-stretch gap-1">
          <span className="text-sm">
            Height {newParams?.height != null ? "(Changed)" : ""}
          </span>
          <input
            className="input-text"
            type="number"
            min={64}
            max={2048}
            step={64}
            disabled={getParams.isLoading || !getUser.data?.admin}
            value={newParams?.height ??
              getParams.data?.height ??
              0}
            onChange={(e) =>
              setNewParams((params) => ({
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
            disabled={getParams.isLoading || !getUser.data?.admin}
            value={newParams?.height ??
              getParams.data?.height ??
              0}
            onChange={(e) =>
              setNewParams((params) => ({
                ...params,
                height: Number(e.target.value),
              }))}
          />
        </label>
      </div>

      {patchParamsError
        ? (
          <p className="alert">
            <span className="flex-grow">Updating params failed: {patchParamsError}</span>
            <button className="button-ghost" onClick={() => setPatchParamsError(undefined)}>
              Close
            </button>
          </p>
        )
        : null}
      {getParams.error
        ? (
          <p className="alert">
            <span className="flex-grow">
              Loading params failed: {String(getParams.error)}
            </span>
          </p>
        )
        : null}

      <div className="flex gap-2 items-center justify-end">
        <button
          type="button"
          className={cx("button-outlined ripple", getParams.isLoading && "bg-stripes")}
          disabled={getParams.isLoading || !getUser.data?.admin ||
            Object.keys(newParams ?? {}).length === 0}
          onClick={() => setNewParams({})}
        >
          Reset
        </button>
        <button
          type="submit"
          className={cx("button-filled ripple", getParams.isLoading && "bg-stripes")}
          disabled={getParams.isLoading || !getUser.data?.admin ||
            Object.keys(newParams ?? {}).length === 0}
        >
          Save
        </button>
      </div>
    </form>
  );
}
