import { GrammyTypes, IKV } from "../deps.ts";
import { PngInfo, SdTxt2ImgInfo } from "../sd.ts";
import { db } from "./db.ts";

export interface JobSchema {
  task:
    | { type: "txt2img"; params: Partial<PngInfo> }
    | { type: "img2img"; params: Partial<PngInfo>; fileId: string };
  from: GrammyTypes.User;
  chat: GrammyTypes.Chat;
  requestMessageId: number;
  replyMessageId?: number;
  status:
    | { type: "waiting" }
    | { type: "processing"; progress: number; worker: string; updatedDate: Date }
    | { type: "done"; info?: SdTxt2ImgInfo; startDate?: Date; endDate?: Date };
}

export const jobStore = new IKV.Store(db, "job", {
  schema: new IKV.Schema<JobSchema>(),
  indices: ["status.type"],
});
