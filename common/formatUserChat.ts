import { GrammyTypes } from "../deps.ts";

export function formatUserChat(ctx: { from?: GrammyTypes.User; chat?: GrammyTypes.Chat }) {
  const msg: string[] = [];
  if (ctx.from) {
    msg.push(ctx.from.first_name);
    if (ctx.from.last_name) msg.push(ctx.from.last_name);
    if (ctx.from.username) msg.push(`(@${ctx.from.username})`);
    if (ctx.from.language_code) msg.push(`(${ctx.from.language_code.toUpperCase()})`);
  }
  if (ctx.chat) {
    if (
      ctx.chat.type === "group" ||
      ctx.chat.type === "supergroup" ||
      ctx.chat.type === "channel"
    ) {
      msg.push("in");
      msg.push(ctx.chat.title);
      if (
        (ctx.chat.type === "supergroup" || ctx.chat.type === "channel") &&
        ctx.chat.username
      ) {
        msg.push(`(@${ctx.chat.username})`);
      }
    }
  }
  return msg.join(" ");
}
