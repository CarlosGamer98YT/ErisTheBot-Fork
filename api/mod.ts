import { route } from "reroute";
import { serveSpa } from "serve_spa";
import { serveApi } from "./serveApi.ts";
import { fromFileUrl } from "std/path/mod.ts"

export async function serveUi() {
  const server = Deno.serve({ port: 5999 }, (request) =>
    route(request, {
      "/api/*": (request) => serveApi(request),
      "/*": (request) =>
        serveSpa(request, {
          fsRoot: fromFileUrl(new URL("../ui/", import.meta.url)),
          indexFallback: true,
          importMapFile: "../deno.json",
          aliasMap: {
            "/utils/*": "../utils/",
          },
          log: (_request, response) => response.status >= 400,
        }),
    }));

  await server.finished;
}
