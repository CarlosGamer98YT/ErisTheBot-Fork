export type TkvEntry<K extends Deno.KvKey, T> = {
  key: readonly [...K];
  value: T;
  versionstamp: string;
};

export type TkvEntryMaybe<K extends Deno.KvKey, T> = TkvEntry<K, T> | {
  key: readonly [...K];
  value: null;
  versionstamp: null;
};

export type TkvListSelector<K extends Deno.KvKey> =
  | { prefix: KvKeyPrefix<K> }
  | { prefix: KvKeyPrefix<K>; start: readonly [...K] }
  | { prefix: KvKeyPrefix<K>; end: readonly [...K] }
  | { start: readonly [...K]; end: readonly [...K] };

export type KvKeyPrefix<Key extends Deno.KvKey> = Key extends readonly [infer Prefix, ...infer Rest]
  ? readonly [Prefix] | readonly [Prefix, ...Rest]
  : never;

/**
 * Typed wrapper for {@link Deno.Kv}
 */
export class Tkv<K extends Deno.KvKey, T> {
  constructor(readonly db: Deno.Kv) {}

  get(
    key: readonly [...K],
    options: Parameters<Deno.Kv["get"]>[1] = {},
  ): Promise<TkvEntryMaybe<K, T>> {
    return this.db.get<T>(key, options) as any;
  }

  set(
    key: readonly [...K],
    value: T,
    options: Parameters<Deno.Kv["set"]>[2] = {},
  ): ReturnType<Deno.Kv["set"]> {
    return this.db.set(key, value, options);
  }

  atomicSet(
    key: readonly [...K],
    versionstamp: Parameters<Deno.AtomicOperation["check"]>[0]["versionstamp"],
    value: T,
    options: Parameters<Deno.AtomicOperation["set"]>[2] = {},
  ): ReturnType<Deno.AtomicOperation["commit"]> {
    return this.db.atomic()
      .check({ key, versionstamp })
      .set(key, value, options)
      .commit();
  }

  delete(key: readonly [...K]): ReturnType<Deno.Kv["delete"]> {
    return this.db.delete(key);
  }

  atomicDelete(
    key: readonly [...K],
    versionstamp: Parameters<Deno.AtomicOperation["check"]>[0]["versionstamp"],
  ): ReturnType<Deno.AtomicOperation["commit"]> {
    return this.db.atomic()
      .check({ key, versionstamp })
      .delete(key)
      .commit();
  }

  list(
    selector: TkvListSelector<K>,
    options: Parameters<Deno.Kv["list"]>[1] = {},
  ): AsyncIterableIterator<TkvEntry<K, T>> {
    return this.db.list<T>(selector as Deno.KvListSelector, options) as any;
  }
}
