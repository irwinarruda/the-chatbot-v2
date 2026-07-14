import type { UploadFileDTO } from "~/modules/chat/entities/dtos/StorageGatewayDTO";

export type { UploadFileDTO } from "~/modules/chat/entities/dtos/StorageGatewayDTO";

export interface StorageGateway {
  uploadFileAsync(dto: UploadFileDTO): Promise<string>;
}
