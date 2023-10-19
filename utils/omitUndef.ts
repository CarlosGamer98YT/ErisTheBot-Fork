/**
 * Removes all undefined properties from an object.
 */
export function omitUndef<O extends object | undefined>(object: O):
  & { [K in keyof O as undefined extends O[K] ? never : K]: O[K] }
  & { [K in keyof O as undefined extends O[K] ? K : never]?: O[K] & ({} | null) } {
  if (object == undefined) return object as never;
  return Object.fromEntries(
    Object.entries(object).filter(([, v]) => v !== undefined),
  ) as never;
}
