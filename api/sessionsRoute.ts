// deno-lint-ignore-file require-await
import { Endpoint, Route } from "t_rest/server";
import { ulid } from "ulid";

export const sessions = new Map<string, Session>();

export interface Session {
  userId?: number;
}

export const sessionsRoute = {
  POST: new Endpoint(
    { query: null, body: null },
    async () => {
      const id = ulid();
      const session: Session = {};
      sessions.set(id, session);
      return { status: 200, type: "application/json", body: { id, ...session } };
    },
  ),
  GET: new Endpoint(
    { query: { sessionId: { type: "string" } }, body: null },
    async ({ query }) => {
      const id = query.sessionId;
      const session = sessions.get(id);
      if (!session) {
        return { status: 401, type: "text/plain", body: "Session not found" };
      }
      return { status: 200, type: "application/json", body: { id, ...session } };
    },
  ),
} satisfies Route;
