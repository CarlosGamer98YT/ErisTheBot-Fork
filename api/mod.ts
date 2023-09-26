import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { serveDir } from "std/http/file_server.ts";
import { transform } from "swc";
import { generationQueue } from "../app/generationQueue.ts";

const t = initTRPC.create();

export const appRouter = t.router({
  ping: t.procedure.query(() => "pong"),
  getAllGenerationJobs: t.procedure.query(() => {
    return generationQueue.getAllJobs();
  }),
});

export type AppRouter = typeof appRouter;

const webuiRoot = new URL("./webui/", import.meta.url);

export async function serveApi() {
  const server = Deno.serve({ port: 8000 }, async (request) => {
    const requestPath = new URL(request.url).pathname;
    const filePath = webuiRoot.pathname + requestPath;
    const fileExt = filePath.split("/").pop()?.split(".").pop()?.toLowerCase();
    const fileExists = await Deno.stat(filePath).then((stat) => stat.isFile).catch(() => false);

    if (requestPath.startsWith("/api/trpc/")) {
      return fetchRequestHandler({
        endpoint: "/api/trpc",
        req: request,
        router: appRouter,
        createContext: () => ({}),
      });
    }

    if (fileExists) {
      if (fileExt === "ts" || fileExt === "tsx") {
        const file = await Deno.readTextFile(filePath);
        const result = await transform(file, {
          jsc: {
            parser: {
              syntax: "typescript",
              tsx: fileExt === "tsx",
            },
            target: "es2022",
          },
        });
        return new Response(result.code, {
          status: 200,
          headers: {
            "Content-Type": "application/javascript",
          },
        });
      }
    }
    return serveDir(request, {
      fsRoot: webuiRoot.pathname,
    });
  });

  await server.finished;
}
