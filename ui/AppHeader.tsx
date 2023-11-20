import React, { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import useSWR from "swr";
import { cx } from "twind/core";
import { API_URL, fetchApi, handleResponse } from "./apiClient.ts";

function NavTab(props: { to: string; children: ReactNode }) {
  return (
    <NavLink
      className={({ isActive }) => cx("tab", isActive && "tab-active")}
      to={props.to}
    >
      {props.children}
    </NavLink>
  );
}

export function AppHeader(props: {
  className?: string;
  sessionId: string | null;
  onLogOut: () => void;
}) {
  const { className, sessionId, onLogOut } = props;

  const getSession = useSWR(
    sessionId ? ["/sessions/:sessionId", { method: "GET", params: { sessionId } }] as const : null,
    (args) => fetchApi(...args).then(handleResponse),
    { onError: () => onLogOut() },
  );

  const getUser = useSWR(
    getSession.data?.userId
      ? ["/users/:userId", {
        method: "GET",
        params: { userId: String(getSession.data.userId) },
      }] as const
      : null,
    (args) => fetchApi(...args).then(handleResponse),
  );

  const getBot = useSWR(
    ["/bot", { method: "GET" }] as const,
    (args) => fetchApi(...args).then(handleResponse),
  );

  const getUserPhoto = useSWR(
    getSession.data?.userId
      ? ["/users/:userId/photo", {
        method: "GET",
        params: { userId: String(getSession.data.userId) },
      }] as const
      : null,
    () =>
      // elysia fetch can't download file
      fetch(`${API_URL}/users/${getSession.data?.userId}/photo`)
        .then((response) => {
          if (!response.ok) throw new Error(response.statusText);
          return response;
        })
        .then((response) => response.blob())
        .then((blob) => blob ? URL.createObjectURL(blob) : null),
  );

  return (
    <header
      className={cx(
        "bg-zinc-50 dark:bg-zinc-800 shadow-md flex items-center gap-2 px-4 py-1",
        className,
      )}
    >
      {/* logo */}
      <img className="w-12 h-12" src="/favicon.png" alt="logo" />

      {/* tabs */}
      <nav className="flex-grow self-stretch flex items-stretch justify-center gap-2">
        <NavTab to="/">
          Stats
        </NavTab>
        <NavTab to="/admins">
          Admins
        </NavTab>
        <NavTab to="/workers">
          Workers
        </NavTab>
        <NavTab to="/queue">
          Queue
        </NavTab>
        <NavTab to="/settings">
          Settings
        </NavTab>
      </nav>

      {/* loading indicator */}
      {getSession.isLoading || getUser.isLoading ? <div className="spinner" /> : null}

      {/* user avatar */}
      {getUser.data
        ? getUserPhoto.data
          ? (
            <img
              src={getUserPhoto.data}
              alt="avatar"
              className="w-9 h-9 rounded-full"
            />
          )
          : (
            <div className="w-9 h-9 rounded-full bg-zinc-400 dark:bg-zinc-500 flex items-center justify-center text-white text-2xl font-bold select-none">
              {getUser.data.first_name.at(0)?.toUpperCase()}
            </div>
          )
        : null}

      {/* login/logout button */}
      {!getSession.isLoading && !getUser.isLoading && getBot.data && sessionId
        ? (
          getUser.data
            ? (
              <button className="button-outlined" onClick={() => onLogOut()}>
                Logout
              </button>
            )
            : (
              <a
                className="button-filled"
                href={`https://t.me/${getBot.data.username}?start=${sessionId}`}
                target="_blank"
              >
                Login
              </a>
            )
        )
        : null}
    </header>
  );
}
