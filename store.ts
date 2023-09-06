import { ulid } from "./deps.ts";

export class Store<T extends object> {
  constructor(
    private readonly db: Deno.Kv,
    private readonly storeKey: Deno.KvKeyPart,
  ) {
  }

  async create(value: T): Promise<Model<T>> {
    const id = ulid();
    await this.db.set([this.storeKey, id], value);
    return new Model(this.db, this.storeKey, id, value);
  }

  async get(id: Deno.KvKeyPart): Promise<Model<T> | null> {
    const entry = await this.db.get<T>([this.storeKey, id]);
    if (entry.versionstamp == null) return null;
    return new Model(this.db, this.storeKey, id, entry.value);
  }

  async list(): Promise<Array<Model<T>>> {
    const models: Array<Model<T>> = [];
    for await (const entry of this.db.list<T>({ prefix: [this.storeKey] })) {
      models.push(new Model(this.db, this.storeKey, entry.key[1], entry.value));
    }
    return models;
  }
}

export class Model<T extends object> {
  #value: T;

  constructor(
    private readonly db: Deno.Kv,
    private readonly storeKey: Deno.KvKeyPart,
    private readonly entryKey: Deno.KvKeyPart,
    value: T,
  ) {
    this.#value = value;
  }

  get value(): T {
    return this.#value;
  }

  async get(): Promise<T | null> {
    const entry = await this.db.get<T>([this.storeKey, this.entryKey]);
    if (entry.versionstamp == null) return null;
    this.#value = entry.value;
    return entry.value;
  }

  async set(value: T): Promise<T> {
    await this.db.set([this.storeKey, this.entryKey], value);
    this.#value = value;
    return value;
  }

  async update(value: Partial<T> | ((value: T) => T)): Promise<T | null> {
    const entry = await this.db.get<T>([this.storeKey, this.entryKey]);
    if (entry.versionstamp == null) return null;
    if (typeof value === "function") {
      entry.value = value(entry.value);
    } else {
      entry.value = { ...entry.value, ...value };
    }
    await this.db.set([this.storeKey, this.entryKey], entry.value);
    this.#value = entry.value;
    return entry.value;
  }

  async delete(): Promise<void> {
    await this.db.delete([this.storeKey, this.entryKey]);
  }
}
