/// <reference lib="dom" />
import { createRoot } from "react-dom/client";
import React from "react";
import { App } from "./App.tsx";
import "./twind.ts";
import { BrowserRouter } from "react-router-dom";

createRoot(document.body).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
