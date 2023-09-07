import { Context, DenoKVAdapter, session, SessionFlavor } from "./deps.ts";
import { SdTxt2ImgRequest } from "./sd.ts";

export type MySessionFlavor = SessionFlavor<SessionData>;

export interface SessionData {
  global: GlobalData;
  chat: ChatData;
  user: UserData;
}

export interface GlobalData {
  adminUsernames: string[];
  pausedReason: string | null;
  sdApiUrl: string;
  maxUserJobs: number;
  maxJobs: number;
  defaultParams?: Partial<SdTxt2ImgRequest>;
}

export interface ChatData {
  language: string;
}

export interface UserData {
  steps: number;
  detail: number;
  batchSize: number;
}

const globalDb = await Deno.openKv("./app.db");

const globalDbAdapter = new DenoKVAdapter<GlobalData>(globalDb);

const getDefaultGlobalData = (): GlobalData => ({
  adminUsernames: (Deno.env.get("ADMIN_USERNAMES") ?? "").split(",").filter(Boolean),
  pausedReason: null,
  sdApiUrl: Deno.env.get("SD_API_URL") ?? "http://127.0.0.1:7860/",
  maxUserJobs: 3,
  maxJobs: 20,
  defaultParams: {
    batch_size: 1,
    n_iter: 1,
    width: 128 * 2,
    height: 128 * 3,
    steps: 20,
    cfg_scale: 9,
    send_images: true,
    negative_prompt: "boring_e621_fluffyrock_v4 boring_e621_v4",
  },
});

export const mySession = session<SessionData, Context & MySessionFlavor>({
  type: "multi",
  global: {
    getSessionKey: () => "global",
    initial: getDefaultGlobalData,
    storage: globalDbAdapter,
  },
  chat: {
    initial: () => ({
      language: "en",
    }),
  },
  user: {
    getSessionKey: (ctx) => ctx.from?.id.toFixed(),
    initial: () => ({
      steps: 20,
      detail: 8,
      batchSize: 2,
    }),
  },
});

export async function getGlobalSession(): Promise<GlobalData> {
  const data = await globalDbAdapter.read("global");
  return data ?? getDefaultGlobalData();
}
