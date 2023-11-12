import React, { useRef } from "react";
import useSWR, { useSWRConfig } from "swr";
import { AdminData } from "../api/adminsRoute.ts";
import { fetchApi, handleResponse } from "./apiClient.ts";

export function AdminsPage(props: { sessionId: string | null }) {
  const { sessionId } = props;

  const { mutate } = useSWRConfig();

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

  const getAdmins = useSWR(
    ["admins", "GET", {}] as const,
    (args) => fetchApi(...args).then(handleResponse),
  );

  return (
    <>
      {getUser.data && getAdmins.data && getAdmins.data.length === 0 && (
        <button
          className="button-filled"
          onClick={() => {
            mutate(
              (key) => Array.isArray(key) && key[0] === "admins",
              async () =>
                fetchApi("admins/promote_self", "POST", {
                  query: { sessionId: sessionId ?? "" },
                }).then(handleResponse),
              { populateCache: false },
            );
          }}
        >
          Promote me to admin
        </button>
      )}

      {getAdmins.data?.length
        ? (
          <ul className="flex flex-col gap-2">
            {getAdmins.data.map((admin) => (
              <AdminListItem key={admin.id} admin={admin} sessionId={sessionId} />
            ))}
          </ul>
        )
        : getAdmins.data?.length === 0
        ? (
          <ul className="flex flex-col gap-2">
            <li className="flex flex-col gap-2 rounded-md bg-zinc-100 dark:bg-zinc-800 p-2">
              <p key="no-admins" className="text-center text-gray-500">No admins.</p>
            </li>
          </ul>
        )
        : getAdmins.error
        ? <p className="alert">Loading admins failed</p>
        : <div className="spinner self-center" />}

      {getUser.data?.admin && (
        <button
          className="button-filled"
          onClick={() => addDialogRef.current?.showModal()}
        >
          Add admin
        </button>
      )}

      <AddAdminDialog
        dialogRef={addDialogRef}
        sessionId={sessionId}
      />
    </>
  );
}

function AddAdminDialog(props: {
  dialogRef: React.RefObject<HTMLDialogElement>;
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
          mutate(
            (key) => Array.isArray(key) && key[0] === "admins",
            async () =>
              fetchApi("admins", "POST", {
                query: { sessionId: sessionId! },
                body: {
                  type: "application/json",
                  data: {
                    tgUserId: Number(data.get("tgUserId") as string),
                  },
                },
              }).then(handleResponse),
            { populateCache: false },
          );
          dialogRef.current?.close();
        }}
      >
        <label className="flex flex-col items-stretch gap-1">
          <span className="text-sm">
            Telegram user ID
          </span>
          <input
            className="input-text"
            type="text"
            name="tgUserId"
            required
            pattern="-?\d+"
          />
        </label>

        <div className="flex gap-2 items-center justify-end">
          <button
            type="button"
            className="button-outlined"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </button>
          <button type="submit" className="button-filled">
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}

function AdminListItem(props: { admin: AdminData; sessionId: string | null }) {
  const { admin, sessionId } = props;

  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  const getAdminUser = useSWR(
    ["users/{userId}", "GET", { params: { userId: String(admin.tgUserId) } }] as const,
    (args) => fetchApi(...args).then(handleResponse),
  );

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
        {getAdminUser.data?.first_name ?? admin.id} {getAdminUser.data?.last_name}{" "}
        {getAdminUser.data?.username
          ? (
            <a href={`https://t.me/${getAdminUser.data.username}`} className="link">
              @{getAdminUser.data.username}
            </a>
          )
          : null}
      </p>
      {getAdminUser.data?.bio
        ? (
          <p>
            {getAdminUser.data?.bio}
          </p>
        )
        : null}
      {getUser.data?.admin && (
        <p className="flex gap-2">
          <button
            className="button-outlined"
            onClick={() => deleteDialogRef.current?.showModal()}
          >
            Delete
          </button>
        </p>
      )}
      <DeleteAdminDialog
        dialogRef={deleteDialogRef}
        adminId={admin.id}
        sessionId={sessionId}
      />
    </li>
  );
}

function DeleteAdminDialog(props: {
  dialogRef: React.RefObject<HTMLDialogElement>;
  adminId: string;
  sessionId: string | null;
}) {
  const { dialogRef, adminId, sessionId } = props;
  const { mutate } = useSWRConfig();

  return (
    <dialog
      ref={dialogRef}
      className="dialog animate-pop-in backdrop-animate-fade-in"
    >
      <form
        method="dialog"
        className="flex flex-col gap-4 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutate(
            (key) => Array.isArray(key) && key[0] === "admins",
            async () =>
              fetchApi("admins/{adminId}", "DELETE", {
                query: { sessionId: sessionId! },
                params: { adminId: adminId },
              }).then(handleResponse),
            { populateCache: false },
          );
          dialogRef.current?.close();
        }}
      >
        <p>
          Are you sure you want to delete this admin?
        </p>
        <div className="flex gap-2 items-center justify-end">
          <button
            type="button"
            className="button-outlined"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </button>
          <button type="submit" className="button-filled">
            Delete
          </button>
        </div>
      </form>
    </dialog>
  );
}
