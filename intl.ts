import { FormattedString } from "./deps.ts";

export function formatOrdinal(n: number) {
  if (n % 100 === 11 || n % 100 === 12 || n % 100 === 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

/**
 * Like `fmt` from `grammy_parse_mode` but accepts an array instead of template string.
 * @see https://deno.land/x/grammy_parse_mode@1.7.1/format.ts?source=#L182
 */
export function fmtArray(
  stringLikes: FormattedString[],
  separator = "",
): FormattedString {
  let text = "";
  const entities: ConstructorParameters<typeof FormattedString>[1] = [];
  for (let i = 0; i < stringLikes.length; i++) {
    const stringLike = stringLikes[i];
    entities.push(
      ...stringLike.entities.map((e) => ({
        ...e,
        offset: e.offset + text.length,
      })),
    );
    text += stringLike.toString();
    if (i < stringLikes.length - 1) text += separator;
  }
  return new FormattedString(text, entities);
}
