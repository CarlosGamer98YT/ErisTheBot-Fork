import { log, ulid } from "./deps.ts";

const logger = () => log.getLogger("kvStore");

export type validIndexKey<T> = {
  [K in keyof T]: K extends string ? (T[K] extends Deno.KvKeyPart ? K
      : T[K] extends readonly unknown[] ? never
      : T[K] extends object ? `${K}.${validIndexKey<T[K]>}`
      : never)
    : never;
}[keyof T];

export type indexValue<T, I extends validIndexKey<T>> = I extends `${infer K}.${infer Rest}`
  ? K extends keyof T ? Rest extends validIndexKey<T[K]> ? indexValue<T[K], Rest>
    : never
  : never
  : I extends keyof T ? T[I]
  : never;

export class Schema<T> {}

interface StoreOptions<T, I> {
  readonly schema: Schema<T>;
  readonly indices: readonly I[];
}

export class Store<T, I extends validIndexKey<T>> {
  readonly #db: Deno.Kv;
  readonly #key: Deno.KvKeyPart;
  readonly #indices: readonly I[];

  constructor(db: Deno.Kv, key: Deno.KvKeyPart, options: StoreOptions<T, I>) {
    this.#db = db;
    this.#key = key;
    this.#indices = options.indices;
  }

  async create(value: T): Promise<Model<T>> {
    const id = ulid();
    await this.#db.set([this.#key, "id", id], value);
    logger().debug(["created", this.#key, "id", id].join(" "));
    for (const index of this.#indices) {
      const indexValue: Deno.KvKeyPart = index
        .split(".")
        .reduce((value, key) => value[key], value as any);
      await this.#db.set([this.#key, index, indexValue, id], value);
      logger().debug(["created", this.#key, index, indexValue, id].join(" "));
    }
    return new Model(this.#db, this.#key, this.#indices, id, value);
  }

  async get(id: Deno.KvKeyPart): Promise<Model<T> | null> {
    const entry = await this.#db.get<T>([this.#key, "id", id]);
    if (entry.versionstamp == null) return null;
    return new Model(this.#db, this.#key, this.#indices, id, entry.value);
  }

  async getBy<J extends I>(
    index: J,
    value: indexValue<T, J>,
    options?: Deno.KvListOptions,
  ): Promise<Array<Model<T>>> {
    const models: Model<T>[] = [];
    for await (
      const entry of this.#db.list<T>(
        { prefix: [this.#key, index, value as Deno.KvKeyPart] },
        options,
      )
    ) {
      models.push(new Model(this.#db, this.#key, this.#indices, entry.key[3], entry.value));
    }
    return models;
  }

  async getAll(
    opts?: { limit?: number; reverse?: boolean },
  ): Promise<Array<Model<T>>> {
    const { limit, reverse } = opts ?? {};
    const models: Array<Model<T>> = [];
    for await (
      const entry of this.#db.list<T>({
        prefix: [this.#key, "id"],
      }, { limit, reverse })
    ) {
      models.push(new Model(this.#db, this.#key, this.#indices, entry.key[2], entry.value));
    }
    return models;
  }

  async deleteAll(): Promise<void> {
    for await (const entry of this.#db.list({ prefix: [this.#key] })) {
      await this.#db.delete(entry.key);
      logger().debug(["deleted", ...entry.key].join(" "));
    }
  }
}

export class Model<T> {
  readonly #db: Deno.Kv;
  readonly #key: Deno.KvKeyPart;
  readonly #indices: readonly string[];
  readonly #id: Deno.KvKeyPart;
  value: T;

  constructor(
    db: Deno.Kv,
    key: Deno.KvKeyPart,
    indices: readonly string[],
    id: Deno.KvKeyPart,
    value: T,
  ) {
    this.#db = db;
    this.#key = key;
    this.#indices = indices;
    this.#id = id;
    this.value = value;
  }

  get id(): Deno.KvKeyPart {
    return this.#id;
  }

  async update(updater: Partial<T> | ((value: T) => T)): Promise<T | null> {
    // get current main entry
    const oldEntry = await this.#db.get<T>([this.#key, "id", this.#id]);

    // get all current index entries
    const oldIndexEntries: Record<string, Deno.KvEntryMaybe<T>> = {};
    for (const index of this.#indices) {
      const indexKey: Deno.KvKeyPart = index
        .split(".")
        .reduce((value, key) => value[key], oldEntry.value as any);
      oldIndexEntries[index] = await this.#db.get<T>([this.#key, index, indexKey, this.#id]);
    }

    // compute new value
    if (typeof updater === "function") {
      this.value = updater(this.value);
    } else {
      this.value = { ...this.value, ...updater };
    }

    // begin transaction
    const transaction = this.#db.atomic();

    // set the main entry
    transaction
      .check(oldEntry)
      .set([this.#key, "id", this.#id], this.value);
    logger().debug(["updated", this.#key, "id", this.#id].join(" "));

    // delete and create all changed index entries
    for (const index of this.#indices) {
      const oldIndexKey: Deno.KvKeyPart = index
        .split(".")
        .reduce((value, key) => value[key], oldIndexEntries[index].value as any);
      const newIndexKey: Deno.KvKeyPart = index
        .split(".")
        .reduce((value, key) => value[key], this.value as any);
      if (newIndexKey !== oldIndexKey) {
        transaction
          .check(oldIndexEntries[index])
          .delete([this.#key, index, oldIndexKey, this.#id])
          .set([this.#key, index, newIndexKey, this.#id], this.value);
        logger().debug(["deleted", this.#key, index, oldIndexKey, this.#id].join(" "));
        logger().debug(["created", this.#key, index, newIndexKey, this.#id].join(" "));
      }
    }

    // commit
    const result = await transaction.commit();
    if (!result.ok) throw new Error(`Failed to update ${this.#key} ${this.#id}`);
    return this.value;
  }

  async delete(): Promise<void> {
    // get current main entry
    const entry = await this.#db.get<T>([this.#key, "id", this.#id]);

    // begin transaction
    const transaction = this.#db.atomic();

    // delete main entry
    transaction
      .check(entry)
      .delete([this.#key, "id", this.#id]);
    logger().debug(["deleted", this.#key, "id", this.#id].join(" "));

    // delete all index entries
    for (const index of this.#indices) {
      const indexKey: Deno.KvKeyPart = index
        .split(".")
        .reduce((value, key) => value[key], entry.value as any);
      transaction
        .delete([this.#key, index, indexKey, this.#id]);
      logger().debug(["deleted", this.#key, index, indexKey, this.#id].join(" "));
    }

    // commit
    const result = await transaction.commit();
    if (!result.ok) throw new Error(`Failed to delete ${this.#key} ${this.#id}`);
  }
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delayMs?: number } = {},
): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000 } = options;
  let error: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      error = err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw error;
}

export async function collectIterator<T>(
  iterator: AsyncIterableIterator<T>,
  options: { maxItems?: number; timeoutMs?: number } = {},
): Promise<T[]> {
  const { maxItems = 1000, timeoutMs = 2000 } = options;
  const result: T[] = [];
  const timeout = setTimeout(() => iterator.return?.(), timeoutMs);
  try {
    for await (const item of iterator) {
      result.push(item);
      if (result.length >= maxItems) {
        iterator.return?.();
        break;
      }
    }
  } finally {
    clearTimeout(timeout);
  }
  return result;
}
