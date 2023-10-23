import React, { RefObject, useRef, useState } from "react";
import { FormattedRelativeTime } from "react-intl";
import useSWR, { useSWRConfig } from "swr";
import { WorkerData } from "../api/workersRoute.ts";
import { Counter } from "./Counter.tsx";
import { fetchApi, handleResponse } from "./apiClient.ts";

export function WorkersPage(props: { sessionId: string | null }) {
  const { sessionId } = props;

  const addDialogRef = useRef<HTMLDialogElement>(null);

  const getSession = useSWR(
    sessionId ? ["sessions/{sessionId}", "GET", { params: { sessionId } }] as const : null,
    (args) => fetchApi(...args).then(handleResponse),
  );
  const getUser = useSWR(
    getSession.data?.userId
      ? ["users/{userId}", "GET", { params: { userId: String(getSession.data.userId) } }] as const
      : null,
    (args) => fetchApi(...args).then(handleResponse),
  );

  const getWorkers = useSWR(
    ["workers", "GET", {}] as const,
    (args) => fetchApi(...args).then(handleResponse),
    { refreshInterval: 5000 },
  );

  return (
    <>
      {getWorkers.data?.length
        ? (
          <ul className="my-4 flex flex-col gap-2">
            {getWorkers.data?.map((worker) => (
              <WorkerListItem key={worker.id} worker={worker} sessionId={sessionId} />
            ))}
          </ul>
        )
        : getWorkers.data?.length === 0
        ? <p>No workers</p>
        : getWorkers.error
        ? <p className="alert">Loading workers failed</p>
        : <div className="spinner self-center" />}

      {getUser.data?.admin && (
        <button
          className="button-filled"
          onClick={() => addDialogRef.current?.showModal()}
        >
          Add worker
        </button>
      )}

      <AddWorkerDialog
        dialogRef={addDialogRef}
        sessionId={sessionId}
      />
    </>
  );
}

function AddWorkerDialog(props: {
  dialogRef: RefObject<HTMLDialogElement>;
  sessionId: string | null;
}) {
  const { dialogRef, sessionId } = props;

  const { mutate } = useSWRConfig();

  return (
    <dialog ref={dialogRef} className="dialog animate-pop-in backdrop-animate-fade-in">
      <form
        method="dialog"
        className="flex flex-col gap-4 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.target as HTMLFormElement);
          const key = data.get("key") as string;
          const name = data.get("name") as string;
          const sdUrl = data.get("url") as string;
          const user = data.get("user") as string;
          const password = data.get("password") as string;
          console.log(key, name, user, password);
          mutate(
            (key) => Array.isArray(key) && key[0] === "workers",
            async () =>
              fetchApi("workers", "POST", {
                query: { sessionId: sessionId! },
                body: {
                  type: "application/json",
                  data: {
                    key,
                    name: name || null,
                    sdUrl,
                    sdAuth: user && password ? { user, password } : null,
                  },
                },
              }).then(handleResponse),
            { populateCache: false },
          );
          dialogRef.current?.close();
        }}
      >
        <div className="flex gap-4">
          <label className="flex flex-1 flex-col items-stretch gap-1">
            <span className="text-sm">
              Key
            </span>
            <input
              className="input-text"
              type="text"
              name="key"
              required
            />
            <span className="text-sm text-zinc-500">
              Used for counting statistics
            </span>
          </label>
          <label className="flex flex-1 flex-col items-stretch gap-1">
            <span className="text-sm">
              Name
            </span>
            <input
              className="input-text"
              type="text"
              name="name"
            />
            <span className="text-sm text-zinc-500">
              Used for display
            </span>
          </label>
        </div>
        <label className="flex flex-col items-stretch gap-1">
          <span className="text-sm">
            URL
          </span>
          <input
            className="input-text"
            type="url"
            name="url"
            required
            pattern="https?://.*"
          />
        </label>
        <div className="flex gap-4">
          <label className="flex flex-1 flex-col items-stretch gap-1">
            <span className="text-sm">
              User
            </span>
            <input
              className="input-text"
              type="text"
              name="user"
            />
          </label>
          <label className="flex flex-1 flex-col items-stretch gap-1">
            <span className="text-sm">
              Password
            </span>
            <input
              className="input-text"
              type="password"
              name="password"
            />
          </label>
        </div>

        <div className="flex gap-2 items-center justify-end">
          <button
            type="button"
            className="button-outlined"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </button>
          <button type="submit" disabled={!sessionId} className="button-filled">
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}

function WorkerListItem(props: {
  worker: WorkerData;
  sessionId: string | null;
}) {
  const { worker, sessionId } = props;
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  const getSession = useSWR(
    sessionId ? ["sessions/{sessionId}", "GET", { params: { sessionId } }] as const : null,
    (args) => fetchApi(...args).then(handleResponse),
  );
  const getUser = useSWR(
    getSession.data?.userId
      ? ["users/{userId}", "GET", { params: { userId: String(getSession.data.userId) } }] as const
      : null,
    (args) => fetchApi(...args).then(handleResponse),
  );

  return (
    <li className="flex flex-col gap-2 rounded-md bg-zinc-100 dark:bg-zinc-800 p-2">
      <p className="font-bold">
        {worker.name ?? worker.key}
      </p>
      {worker.isActive ? <p>✅ Active</p> : (
        <>
          <p>
            Last seen {worker.lastOnlineTime
              ? (
                <FormattedRelativeTime
                  value={(worker.lastOnlineTime - Date.now()) / 1000}
                  numeric="auto"
                  updateIntervalInSeconds={1}
                />
              )
              : "never"}
          </p>
          {worker.lastError && (
            <p className="text-red-500">
              {worker.lastError.message} (
              <FormattedRelativeTime
                value={(worker.lastError.time - Date.now()) / 1000}
                numeric="auto"
                updateIntervalInSeconds={1}
              />)
            </p>
          )}
        </>
      )}
      <p className="flex gap-1">
        <Counter value={worker.imagesPerMinute} digits={2} fractionDigits={1} /> images per minute,
        {" "}
        <Counter value={worker.stepsPerMinute} digits={3} /> steps per minute
      </p>
      {getUser.data?.admin && (
        <p className="flex gap-2">
          <button
            className="button-outlined"
            onClick={() => editDialogRef.current?.showModal()}
          >
            Settings
          </button>
          <button
            className="button-outlined"
            onClick={() => deleteDialogRef.current?.showModal()}
          >
            Delete
          </button>
        </p>
      )}
      <EditWorkerDialog
        dialogRef={editDialogRef}
        workerId={worker.id}
        sessionId={sessionId}
      />
      <DeleteWorkerDialog
        dialogRef={deleteDialogRef}
        workerId={worker.id}
        sessionId={sessionId}
      />
    </li>
  );
}

function EditWorkerDialog(props: {
  dialogRef: RefObject<HTMLDialogElement>;
  workerId: string;
  sessionId: string | null;
}) {
  const { dialogRef, workerId, sessionId } = props;

  const { mutate } = useSWRConfig();

  return (
    <dialog
      className="dialog animate-pop-in backdrop-animate-fade-in"
      ref={dialogRef}
    >
      <form
        method="dialog"
        className="flex flex-col gap-4 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.target as HTMLFormElement);
          const user = data.get("user") as string;
          const password = data.get("password") as string;
          console.log(user, password);
          mutate(
            (key) => Array.isArray(key) && key[0] === "workers",
            async () =>
              fetchApi("workers/{workerId}", "PATCH", {
                params: { workerId: workerId },
                query: { sessionId: sessionId! },
                body: {
                  type: "application/json",
                  data: {
                    sdAuth: user && password ? { user, password } : null,
                  },
                },
              }).then(handleResponse),
            { populateCache: false },
          );
          dialogRef.current?.close();
        }}
      >
        <div className="flex gap-4">
          <label className="flex flex-1 flex-col items-stretch gap-1">
            <span className="text-sm">
              User
            </span>
            <input
              className="input-text"
              type="text"
              name="user"
            />
          </label>
          <label className="flex flex-1 flex-col items-stretch gap-1">
            <span className="text-sm">
              Password
            </span>
            <input
              className="input-text"
              type="password"
              name="password"
            />
          </label>
        </div>
        <div className="flex gap-2 items-center justify-end">
          <button
            type="button"
            className="button-outlined"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </button>
          <button type="submit" disabled={!sessionId} className="button-filled">
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}

function DeleteWorkerDialog(props: {
  dialogRef: RefObject<HTMLDialogElement>;
  workerId: string;
  sessionId: string | null;
}) {
  const { dialogRef, workerId, sessionId } = props;
  const { mutate } = useSWRConfig();

  return (
    <dialog
      className="dialog animate-pop-in backdrop-animate-fade-in"
      ref={dialogRef}
    >
      <form
        method="dialog"
        className="flex flex-col gap-4 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutate(
            (key) => Array.isArray(key) && key[0] === "workers",
            async () =>
              fetchApi("workers/{workerId}", "DELETE", {
                params: { workerId: workerId },
                query: { sessionId: sessionId! },
              }).then(handleResponse),
            { populateCache: false },
          );
          dialogRef.current?.close();
        }}
      >
        <p>
          Are you sure you want to delete this worker?
        </p>
        <div className="flex gap-2 items-center justify-end">
          <button
            type="button"
            className="button-outlined"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </button>
          <button type="submit" disabled={!sessionId} className="button-filled">
            Delete
          </button>
        </div>
      </form>
    </dialog>
  );
}
