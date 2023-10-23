import { Chat } from "grammy_types";
import { Model } from "indexed_kv";
import { Output } from "t_rest/client";
import { Admin, adminStore } from "../app/adminStore.ts";
import { bot } from "../bot/mod.ts";
import { sessions } from "./sessionsRoute.ts";

export async function withUser<O extends Output>(
  query: { sessionId: string },
  cb: (user: Chat.PrivateGetChat) => Promise<O>,
) {
  const session = sessions.get(query.sessionId);
  if (!session?.userId) {
    return { status: 401, body: { type: "text/plain", data: "Must be logged in" } } as const;
  }
  const user = await getUser(session.userId);
  return cb(user);
}

export async function withAdmin<O extends Output>(
  query: { sessionId: string },
  cb: (user: Chat.PrivateGetChat, admin: Model<Admin>) => Promise<O>,
) {
  const session = sessions.get(query.sessionId);
  if (!session?.userId) {
    return { status: 401, body: { type: "text/plain", data: "Must be logged in" } } as const;
  }
  const user = await getUser(session.userId);
  const [admin] = await adminStore.getBy("tgUserId", { value: session.userId });
  if (!admin) {
    return { status: 403, body: { type: "text/plain", data: "Must be an admin" } } as const;
  }
  return cb(user, admin);
}

export async function getUser(userId: number): Promise<Chat.PrivateGetChat> {
  const chat = await bot.api.getChat(userId);
  if (chat.type !== "private") throw new Error("Chat is not private");
  return chat;
}
