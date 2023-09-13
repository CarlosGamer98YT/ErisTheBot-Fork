import { GrammyTypes, IKV } from "../deps.ts";
import { SdTxt2ImgInfo } from "../common/sdApi.ts";
import { PngInfo } from "../common/parsePngInfo.ts";
import { db } from "./db.ts";

export interface JobSchema {
  task:
    | {
      type: "txt2img";
      params: Partial<PngInfo>;
    }
    | {
      type: "img2img";
      params: Partial<PngInfo>;
      fileId: string;
    };
  from: GrammyTypes.User;
  chat: GrammyTypes.Chat;
  requestMessageId: number;
  status:
    | {
      type: "waiting";
      message?: GrammyTypes.Message.TextMessage;
    }
    | {
      type: "processing";
      progress: number;
      worker: string;
      updatedDate: Date;
      message?: GrammyTypes.Message.TextMessage;
    }
    | {
      type: "done";
      info?: SdTxt2ImgInfo;
      startDate?: Date;
      endDate?: Date;
    };
}

export const jobStore = new IKV.Store(db, "job", {
  schema: new IKV.Schema<JobSchema>(),
  indices: ["status.type"],
});
