import { KVFS } from "../deps.ts";

export const db = await Deno.openKv("./app.db");
export const fs = new KVFS.KvFs(db);
