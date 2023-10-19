export interface KvMemoizeOptions<A extends Deno.KvKey, R> {
  /**
   * The time in milliseconds until the cached result expires.
   */
  expireIn?: ((result: R, ...args: A) => number) | number | undefined;
  /**
   * Whether to recalculate the result if it was already cached.
   *
   * Runs whenever the result is retrieved from the cache.
   */
  shouldRecalculate?: ((result: R, ...args: A) => boolean) | undefined;
  /**
   * Whether to cache the result after computing it.
   *
   * Runs whenever a new result is computed.
   */
  shouldCache?: ((result: R, ...args: A) => boolean) | undefined;
  /**
   * Override the default KV store functions.
   */
  override?: {
    set: (
      key: Deno.KvKey,
      args: A,
      value: R,
      options: { expireIn?: number },
    ) => Promise<void>;
    get: (key: Deno.KvKey, args: A) => Promise<R | undefined>;
  };
}

/**
 * Memoizes the function result in KV store.
 */
export function kvMemoize<A extends Deno.KvKey, R>(
  db: Deno.Kv,
  key: Deno.KvKey,
  fn: (...args: A) => Promise<R>,
  options?: KvMemoizeOptions<A, R>,
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
        await options.override.set(key, args, result, expireIn != null ? { expireIn } : {});
      } else {
        await db.set([...key, ...args], result, expireIn != null ? { expireIn } : {});
      }
    }

    return result;
  };
}
