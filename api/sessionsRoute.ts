import { createEndpoint, createMethodFilter, createPathFilter } from "t_rest/server";
import { ulid } from "ulid";

export const sessions = new Map<string, Session>();

export interface Session {
  userId?: number | undefined;
}

export const sessionsRoute = createPathFilter({
  "": createMethodFilter({
    POST: createEndpoint(
      { query: null, body: null },
      async () => {
        const id = ulid();
        const session: Session = {};
        sessions.set(id, session);
        return { status: 200, body: { type: "application/json", data: { id, ...session } } };
      },
    ),
  }),

  "{sessionId}": createMethodFilter({
    GET: createEndpoint(
      { query: null, body: null },
      async ({ params }) => {
        const id = params.sessionId!;
        const session = sessions.get(id);
        if (!session) {
          return { status: 401, body: { type: "text/plain", data: "Session not found" } };
        }
        return { status: 200, body: { type: "application/json", data: { id, ...session } } };
      },
    ),
  }),
});
