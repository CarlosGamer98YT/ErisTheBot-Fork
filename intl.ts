import { FormattedString } from "./deps.ts";

export function formatOrdinal(n: number) {
  if (n % 100 === 11 || n % 100 === 12 || n % 100 === 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

type DeepArray<T> = Array<T | DeepArray<T>>;
type StringLikes = DeepArray<FormattedString | string | number | null | undefined>;

/**
 * Like `fmt` from `grammy_parse_mode` but additionally accepts arrays.
 * @see https://deno.land/x/grammy_parse_mode@1.7.1/format.ts?source=#L182
 */
export const fmt = (
  rawStringParts: TemplateStringsArray | StringLikes,
  ...stringLikes: StringLikes
): FormattedString => {
  let text = "";
  const entities: ConstructorParameters<typeof FormattedString>[1][] = [];

  const length = Math.max(rawStringParts.length, stringLikes.length);
  for (let i = 0; i < length; i++) {
    for (let stringLike of [rawStringParts[i], stringLikes[i]]) {
      if (Array.isArray(stringLike)) {
        stringLike = fmt(stringLike);
      }
      if (stringLike instanceof FormattedString) {
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
  return new FormattedString(text, entities);
};
