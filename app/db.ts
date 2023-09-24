import { KvFs } from "kvfs";

export const db = await Deno.openKv("./app.db");
export const fs = new KvFs(db);
