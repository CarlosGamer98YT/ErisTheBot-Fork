import { Chat } from "grammy_types";
import { Output } from "t_rest/client";
import { getConfig } from "../app/config.ts";
import { bot } from "../bot/mod.ts";
import { sessions } from "./sessionsRoute.ts";

export async function withUser<O extends Output>(
  query: { sessionId: string },
  cb: (user: Chat.PrivateGetChat) => Promise<O>,
  options?: { admin?: boolean },
) {
  const session = sessions.get(query.sessionId);
  if (!session?.userId) {
    return { status: 401, body: { type: "text/plain", data: "Must be logged in" } } as const;
  }
  const chat = await bot.api.getChat(session.userId);
  if (chat.type !== "private") throw new Error("Chat is not private");
  if (options?.admin) {
    if (!chat.username) {
      return { status: 403, body: { type: "text/plain", data: "Must have a username" } } as const;
    }
    const config = await getConfig();
    if (!config?.adminUsernames?.includes(chat.username)) {
      return { status: 403, body: { type: "text/plain", data: "Must be an admin" } } as const;
    }
  }
  return cb(chat);
}
