import { Chat } from "grammy_types";
import { Admin, adminStore } from "../app/adminStore.ts";
import { bot } from "../bot/mod.ts";
import { sessions } from "./sessionsRoute.ts";
import { TkvEntry } from "../utils/Tkv.ts";

export async function withSessionUser<O>(
  { query, set }: { query: { sessionId: string }; set: { status?: string | number } },
  cb: (sessionUser: Chat.PrivateGetChat) => Promise<O>,
) {
  const session = sessions.get(query.sessionId);
  if (!session?.userId) {
    set.status = 401;
    return "Must be logged in";
  }
  const user = await getUser(session.userId);
  return cb(user);
}

export async function withSessionAdmin<O>(
  { query, set }: { query: { sessionId: string }; set: { status?: string | number } },
  cb: (
    sessionUser: Chat.PrivateGetChat,
    sessionAdminEntry: TkvEntry<["admins", number], Admin>,
  ) => Promise<O>,
) {
  const session = sessions.get(query.sessionId);
  if (!session?.userId) {
    set.status = 401;
    return "Must be logged in";
  }
  const sessionUser = await getUser(session.userId);
  const sessionAdminEntry = await adminStore.get(["admins", sessionUser.id]);
  if (!sessionAdminEntry.versionstamp) {
    set.status = 403;
    return "Must be an admin";
  }
  return cb(sessionUser, sessionAdminEntry);
}

export async function getUser(userId: number): Promise<Chat.PrivateGetChat> {
  const chat = await bot.api.getChat(userId);
  if (chat.type !== "private") throw new Error("Chat is not private");
  return chat;
}
