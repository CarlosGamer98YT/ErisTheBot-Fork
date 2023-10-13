/// <reference lib="deno.unstable" />
/// <reference lib="dom" />
import { createRoot } from "react-dom/client";
import React from "react";
import { App } from "./App.tsx";
import "./twind.ts";
import { BrowserRouter } from "react-router-dom";
import { IntlProvider } from "react-intl";

createRoot(document.body).render(
  <BrowserRouter>
    <IntlProvider locale="en">
      <App />
    </IntlProvider>
  </BrowserRouter>,
);
