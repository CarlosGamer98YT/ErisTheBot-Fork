import { CommandContext } from "grammy";
import { bold, fmt, FormattedString } from "grammy_parse_mode";
import { distinctBy } from "std/collections/distinct_by.ts";
import { getConfig } from "../app/config.ts";
import { generationStore } from "../app/generationStore.ts";
import { formatUserChat } from "../utils/formatUserChat.ts";
import { ErisContext, logger } from "./mod.ts";

export async function broadcastCommand(ctx: CommandContext<ErisContext>) {
  if (!ctx.from?.username) {
    return ctx.reply("I don't know who you are.");
  }

  const config = await getConfig();

  if (!config.adminUsernames.includes(ctx.from.username)) {
    return ctx.reply("Only a bot admin can use this command.");
  }

  const text = ctx.match.trim();

  if (!text) {
    return ctx.reply("Please specify a message to broadcast.");
  }

  // find users who interacted with bot in the last 24 hours
  const gens = await generationStore.getAll(
    { after: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    { reverse: true },
  ).then((gens) => distinctBy(gens, (gen) => gen.value.from.id));

  let sentCount = 0;
  const errors: FormattedString[] = [];
  const getMessage = () =>
    fmt([
      fmt`Broadcasted to ${sentCount}/${gens.length} users.\n\n`,
      errors.length > 0 ? fmt([bold("Errors:"), "\n", ...errors]) : "",
    ]);

  const replyMessage = await ctx.replyFmt(getMessage(), {
    reply_to_message_id: ctx.message?.message_id,
  });

  // send message to each user
  for (const gen of gens) {
    try {
      await ctx.api.sendMessage(gen.value.from.id, text);
      logger().info(`Broadcasted to ${formatUserChat({ from: gen.value.from })}`);
      sentCount++;
    } catch (err) {
      logger().error(`Broadcasting to ${formatUserChat({ from: gen.value.from })} failed: ${err}`);
      errors.push(fmt`${bold(formatUserChat({ from: gen.value.from }))} - ${err.message}\n`);
    }
    const fmtMessage = getMessage();
    if (sentCount % 20 === 0) {
      await ctx.api.editMessageText(
        replyMessage.chat.id,
        replyMessage.message_id,
        fmtMessage.text,
        { entities: fmtMessage.entities },
      ).catch(() => undefined);
    }
  }
  const fmtMessage = getMessage();
  await ctx.api.editMessageText(
    replyMessage.chat.id,
    replyMessage.message_id,
    fmtMessage.text,
    { entities: fmtMessage.entities },
  ).catch(() => undefined);
}
