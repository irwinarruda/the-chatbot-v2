import type { UploadFileDTO } from "~/domain/chat/storage";

export type { UploadFileDTO } from "~/domain/chat/storage";

export interface StorageGateway {
  uploadFileAsync(dto: UploadFileDTO): Promise<string>;
}
