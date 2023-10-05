import { route } from "reroute";
import { serveSpa } from "serve_spa";
import { api } from "./api.ts";

export async function serveUi() {
  const server = Deno.serve({ port: 5999 }, (request) =>
    route(request, {
      "/api/*": (request) => api.serve(request),
      "/*": (request) =>
        serveSpa(request, {
          fsRoot: new URL("../ui/", import.meta.url).pathname,
          indexFallback: true,
          importMapFile: "../deno.json",
          aliasMap: {
            "/utils/*": "../utils/",
          },
          quiet: true,
        }),
    }));

  await server.finished;
}
