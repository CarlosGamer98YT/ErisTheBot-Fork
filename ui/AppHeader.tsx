import { cx } from "@twind/core";
import React, { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import useSWR from "swr";
import { fetchApi, handleResponse } from "./apiClient.tsx";

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

export function AppHeader(
  props: { className?: string; sessionId?: string; onLogOut: () => void },
) {
  const { className, sessionId, onLogOut } = props;

  const session = useSWR(
    sessionId ? ["sessions/{sessionId}", "GET", { params: { sessionId } }] as const : null,
    (args) => fetchApi(...args).then(handleResponse),
    { onError: () => onLogOut() },
  );

  const user = useSWR(
    session.data?.userId
      ? ["users/{userId}", "GET", { params: { userId: String(session.data.userId) } }] as const
      : null,
    (args) => fetchApi(...args).then(handleResponse),
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
        <NavTab to="/queue">
          Queue
        </NavTab>
        <NavTab to="/settings">
          Settings
        </NavTab>
      </nav>

      {/* loading indicator */}
      {session.isLoading || user.isLoading ? <div className="spinner" /> : null}

      {/* user avatar */}
      {user.data
        ? user.data.photoData
          ? (
            <img
              src={`data:image/jpeg;base64,${user.data.photoData}`}
              alt="avatar"
              className="w-9 h-9 rounded-full"
            />
          )
          : (
            <div className="w-9 h-9 rounded-full bg-zinc-400 dark:bg-zinc-500 flex items-center justify-center text-white text-2xl font-bold select-none">
              {user.data.first_name.at(0)?.toUpperCase()}
            </div>
          )
        : null}

      {/* login/logout button */}
      {!session.isLoading && !user.isLoading && sessionId
        ? (
          user.data
            ? (
              <button className="button-outlined" onClick={() => onLogOut()}>
                Logout
              </button>
            )
            : (
              <a
                className="button-filled"
                href={`https://t.me/ErisTheBot?start=${sessionId}`}
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
