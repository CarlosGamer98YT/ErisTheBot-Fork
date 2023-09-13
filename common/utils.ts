import { GrammyParseMode, GrammyTypes } from "../deps.ts";

export function formatOrdinal(n: number) {
  if (n % 100 === 11 || n % 100 === 12 || n % 100 === 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

export const fmt = (
  rawStringParts: TemplateStringsArray | GrammyParseMode.Stringable[],
  ...stringLikes: GrammyParseMode.Stringable[]
): GrammyParseMode.FormattedString => {
  let text = "";
  const entities: GrammyTypes.MessageEntity[] = [];

  const length = Math.max(rawStringParts.length, stringLikes.length);
  for (let i = 0; i < length; i++) {
    for (const stringLike of [rawStringParts[i], stringLikes[i]]) {
      if (stringLike instanceof GrammyParseMode.FormattedString) {
        entities.push(
          ...stringLike.entities.map((e) => ({
            ...e,
            offset: e.offset + text.length,
          })),
        );
      }
      if (stringLike != null) text += stringLike.toString();
    }
  }
  return new GrammyParseMode.FormattedString(text, entities);
};

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
