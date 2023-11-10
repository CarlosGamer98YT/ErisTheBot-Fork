import { CommandContext } from "grammy";
import { bold, fmt } from "grammy_parse_mode";
import { StatelessQuestion } from "grammy_stateless_question";
import { omitUndef } from "../utils/omitUndef.ts";
import { ErisContext } from "./mod.ts";
import { getPngInfo, parsePngInfo } from "./parsePngInfo.ts";

export const pnginfoQuestion = new StatelessQuestion<ErisContext>(
  "pnginfo",
  async (ctx) => {
    await pnginfo(ctx, false);
  },
);

export async function pnginfoCommand(ctx: CommandContext<ErisContext>) {
  await pnginfo(ctx, true);
}

async function pnginfo(ctx: ErisContext, includeRepliedTo: boolean): Promise<void> {
  const document = ctx.message?.document ||
    (includeRepliedTo ? ctx.message?.reply_to_message?.document : undefined);

  if (document?.mime_type !== "image/png" && document?.mime_type !== "image/jpeg") {
    await ctx.reply(
      "Please send me a PNG file." +
        pnginfoQuestion.messageSuffixMarkdown(),
      omitUndef(
        {
          reply_markup: { force_reply: true, selective: true },
          parse_mode: "Markdown",
          reply_to_message_id: ctx.message?.message_id,
        } as const,
      ),
    );
    return;
  }

  const file = await ctx.api.getFile(document.file_id);
  const buffer = await fetch(file.getUrl()).then((resp) => resp.arrayBuffer());
  const params = parsePngInfo(getPngInfo(buffer) ?? "Nothing found.", undefined, true);

  const paramsText = fmt([
    `${params.prompt}\n`,
    params.negative_prompt ? fmt`${bold("Negative prompt:")} ${params.negative_prompt}\n` : "",
    params.steps ? fmt`${bold("Steps:")} ${params.steps}, ` : "",
    params.sampler_name ? fmt`${bold("Sampler:")} ${params.sampler_name}, ` : "",
    params.cfg_scale ? fmt`${bold("CFG scale:")} ${params.cfg_scale}, ` : "",
    params.seed ? fmt`${bold("Seed:")} ${params.seed}, ` : "",
    params.width && params.height ? fmt`${bold("Size")}: ${params.width}x${params.height}` : "",
  ]);

  await ctx.reply(
    paramsText.text,
    omitUndef({
      entities: paramsText.entities,
      reply_to_message_id: ctx.message?.message_id,
    }),
  );
}
