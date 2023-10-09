/**
 * Memoizes the function result in KV storage.
 */
export function kvMemoize<A extends Deno.KvKey, R>(
  db: Deno.Kv,
  key: Deno.KvKey,
  fn: (...args: A) => Promise<R>,
  options?: {
    expireIn?: number | ((result: R, ...args: A) => number);
    shouldRecalculate?: (result: R, ...args: A) => boolean;
    shouldCache?: (result: R, ...args: A) => boolean;
    override?: {
      set: (key: Deno.KvKey, args: A, value: R, options: { expireIn?: number }) => Promise<void>;
      get: (key: Deno.KvKey, args: A) => Promise<R | undefined>;
    };
  },
): (...args: A) => Promise<R> {
  return async (...args) => {
    const cachedResult = options?.override?.get
      ? await options.override.get(key, args)
      : (await db.get<R>([...key, ...args])).value;

    if (cachedResult != null) {
      if (!options?.shouldRecalculate?.(cachedResult, ...args)) {
        return cachedResult;
      }
    }

    const result = await fn(...args);

    const expireIn = typeof options?.expireIn === "function"
      ? options.expireIn(result, ...args)
      : options?.expireIn;

    if (options?.shouldCache?.(result, ...args) ?? (result != null)) {
      if (options?.override?.set) {
        await options.override.set(key, args, result, { expireIn });
      } else {
        await db.set([...key, ...args], result, { expireIn });
      }
    }

    return result;
  };
}
