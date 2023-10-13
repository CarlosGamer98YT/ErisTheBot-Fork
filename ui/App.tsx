import React, { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import useLocalStorage from "use-local-storage";
import { AppHeader } from "./AppHeader.tsx";
import { QueuePage } from "./QueuePage.tsx";
import { SettingsPage } from "./SettingsPage.tsx";
import { StatsPage } from "./StatsPage.tsx";
import { WorkersPage } from "./WorkersPage.tsx";
import { fetchApi, handleResponse } from "./apiClient.tsx";

export function App() {
  // store session ID in the local storage
  const [sessionId, setSessionId] = useLocalStorage("sessionId", "");

  // initialize a new session when there is no session ID
  useEffect(() => {
    if (!sessionId) {
      fetchApi("sessions", "POST", {}).then(handleResponse).then((session) => {
        console.log("Initialized session", session.id);
        setSessionId(session.id);
      });
    }
  }, [sessionId]);

  return (
    <>
      <AppHeader
        className="self-stretch"
        sessionId={sessionId}
        onLogOut={() => setSessionId("")}
      />
      <div className="self-center w-full max-w-screen-md flex flex-col items-stretch gap-4 p-4">
        <Routes>
          <Route path="/" element={<StatsPage />} />
          <Route path="/workers" element={<WorkersPage sessionId={sessionId} />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/settings" element={<SettingsPage sessionId={sessionId} />} />
        </Routes>
      </div>
    </>
  );
}
