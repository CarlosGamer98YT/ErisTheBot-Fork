import { db } from "../db/db.ts";
import { Grammy, GrammyKvStorage } from "../deps.ts";
import { SdApi, SdTxt2ImgRequest } from "../common/sdApi.ts";

export type SessionFlavor = Grammy.SessionFlavor<SessionData>;

export interface SessionData {
  global: GlobalData;
  chat: ChatData;
  user: UserData;
}

export interface GlobalData {
  adminUsernames: string[];
  pausedReason: string | null;
  maxUserJobs: number;
  maxJobs: number;
  defaultParams?: Partial<SdTxt2ImgRequest>;
  workers: WorkerData[];
}

export interface WorkerData {
  id: string;
  name?: string;
  api: SdApi;
  maxResolution: number;
}

export interface ChatData {
  language?: string;
}

export interface UserData {
  params?: Partial<SdTxt2ImgRequest>;
}

const globalDbAdapter = new GrammyKvStorage.DenoKVAdapter<GlobalData>(db);

const getDefaultGlobalData = (): GlobalData => ({
  adminUsernames: Deno.env.get("TG_ADMIN_USERS")?.split(",") ?? [],
  pausedReason: null,
  maxUserJobs: 3,
  maxJobs: 20,
  defaultParams: {
    batch_size: 1,
    n_iter: 1,
    width: 512,
    height: 768,
    steps: 30,
    cfg_scale: 10,
    negative_prompt: "boring_e621_fluffyrock_v4 boring_e621_v4",
  },
  workers: [
    {
      id: "local",
      api: { url: Deno.env.get("SD_API_URL") ?? "http://127.0.0.1:7860/" },
      maxResolution: 1024 * 1024,
    },
  ],
});

export const session = Grammy.session<SessionData, Grammy.Context & SessionFlavor>({
  type: "multi",
  global: {
    getSessionKey: () => "global",
    initial: getDefaultGlobalData,
    storage: globalDbAdapter,
  },
  chat: {
    initial: () => ({}),
  },
  user: {
    getSessionKey: (ctx) => ctx.from?.id.toFixed(),
    initial: () => ({}),
  },
});

export async function getGlobalSession(): Promise<GlobalData> {
  const data = await globalDbAdapter.read("global");
  return data ?? getDefaultGlobalData();
}
