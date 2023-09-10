import { GrammyTypes, IKV } from "../deps.ts";
import { SdTxt2ImgInfo, SdTxt2ImgRequest } from "../sd.ts";
import { db } from "./db.ts";

export interface JobSchema {
  params: Partial<SdTxt2ImgRequest>;
  request: GrammyTypes.Message & { from: GrammyTypes.User };
  reply?: GrammyTypes.Message.TextMessage;
  status:
    | { type: "waiting" }
    | { type: "processing"; progress: number; worker: string; updatedDate: Date }
    | { type: "done"; info?: SdTxt2ImgInfo; startDate?: Date; endDate?: Date };
}

export const jobStore = new IKV.Store(db, "job", {
  schema: new IKV.Schema<JobSchema>(),
  indices: ["status.type"],
});
