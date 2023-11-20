import { Elysia, NotFoundError, t } from "elysia";
import { ulid } from "ulid";

export const sessions = new Map<string, Session>();

export interface Session {
  userId?: number | undefined;
}

export const sessionsRoute = new Elysia()
  .post(
    "",
    async () => {
      const id = ulid();
      const session: Session = {};
      sessions.set(id, session);
      return { id, userId: session.userId ?? null };
    },
    {
      response: t.Object({
        id: t.String(),
        userId: t.Nullable(t.Number()),
      }),
    },
  )
  .get(
    "/:sessionId",
    async ({ params }) => {
      const id = params.sessionId!;
      const session = sessions.get(id);
      if (!session) {
        throw new NotFoundError("Session not found");
      }
      return { id, userId: session.userId ?? null };
    },
    {
      params: t.Object({ sessionId: t.String() }),
      response: t.Object({
        id: t.String(),
        userId: t.Nullable(t.Number()),
      }),
    },
  );
