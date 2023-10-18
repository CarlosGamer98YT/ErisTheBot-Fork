import { KvFs } from "kvfs";

export const db = await Deno.openKv(Deno.env.get("DENO_KV_PATH"));
export const fs = new KvFs(db);
