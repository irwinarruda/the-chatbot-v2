import type {
  IStorageGateway,
  UploadFileDTO,
} from "~/modules/chat/application/ports/IStorageGateway";

export class TestStorageGateway implements IStorageGateway {
  async uploadFileAsync(dto: UploadFileDTO): Promise<string> {
    return `https://test-storage.example.com/${dto.key}`;
  }
}
