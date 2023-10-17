import React, { useRef } from "react";
import { FormattedRelativeTime } from "react-intl";
import useSWR, { useSWRConfig } from "swr";
import { WorkerData } from "../api/workersRoute.ts";
import { Counter } from "./Counter.tsx";
import { fetchApi, handleResponse } from "./apiClient.tsx";

export function WorkersPage(props: { sessionId?: string }) {
  const { sessionId } = props;

  const createWorkerModalRef = useRef<HTMLDialogElement>(null);

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

  const workers = useSWR(
    ["workers", "GET", {}] as const,
    (args) => fetchApi(...args).then(handleResponse),
    { refreshInterval: 5000 },
  );

  return (
    <>
      <ul className="my-4 flex flex-col gap-2">
        {workers.data?.map((worker) => (
          <WorkerListItem key={worker.id} worker={worker} sessionId={sessionId} />
        ))}
      </ul>
      {user.data?.isAdmin && (
        <button
          className="button-filled"
          onClick={() => createWorkerModalRef.current?.showModal()}
        >
          Add worker
        </button>
      )}
      <dialog
        className="dialog"
        ref={createWorkerModalRef}
      >
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
            workers.mutate(async () => {
              const worker = await fetchApi("workers", "POST", {
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
              }).then(handleResponse);
              return [...(workers.data ?? []), worker];
            });

            createWorkerModalRef.current?.close();
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
              onClick={() => createWorkerModalRef.current?.close()}
            >
              Close
            </button>
            <button type="submit" disabled={!sessionId} className="button-filled">
              Save
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function WorkerListItem(props: { worker: WorkerData; sessionId?: string }) {
  const { worker, sessionId } = props;
  const editWorkerModalRef = useRef<HTMLDialogElement>(null);
  const deleteWorkerModalRef = useRef<HTMLDialogElement>(null);

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

  const { mutate } = useSWRConfig();

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
      <p className="flex gap-2">
        {user.data?.isAdmin && (
          <>
            <button
              className="button-outlined"
              onClick={() => editWorkerModalRef.current?.showModal()}
            >
              Settings
            </button>
            <button
              className="button-outlined"
              onClick={() => deleteWorkerModalRef.current?.showModal()}
            >
              Delete
            </button>
          </>
        )}
      </p>
      <dialog
        className="dialog"
        ref={editWorkerModalRef}
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
            fetchApi("workers/{workerId}", "PATCH", {
              params: { workerId: worker.id },
              query: { sessionId: sessionId! },
              body: {
                type: "application/json",
                data: {
                  sdAuth: user && password ? { user, password } : null,
                },
              },
            });
            editWorkerModalRef.current?.close();
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
              onClick={() => editWorkerModalRef.current?.close()}
            >
              Close
            </button>
            <button type="submit" disabled={!sessionId} className="button-filled">
              Save
            </button>
          </div>
        </form>
      </dialog>
      <dialog
        className="dialog"
        ref={deleteWorkerModalRef}
      >
        <form
          method="dialog"
          className="flex flex-col gap-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            fetchApi("workers/{workerId}", "DELETE", {
              params: { workerId: worker.id },
              query: { sessionId: sessionId! },
            }).then(handleResponse).then(() => mutate(["workers", "GET", {}]));
            deleteWorkerModalRef.current?.close();
          }}
        >
          <p>
            Are you sure you want to delete this worker?
          </p>
          <div className="flex gap-2 items-center justify-end">
            <button
              type="button"
              className="button-outlined"
              onClick={() => deleteWorkerModalRef.current?.close()}
            >
              Close
            </button>
            <button type="submit" disabled={!sessionId} className="button-filled">
              Delete
            </button>
          </div>
        </form>
      </dialog>
    </li>
  );
}
