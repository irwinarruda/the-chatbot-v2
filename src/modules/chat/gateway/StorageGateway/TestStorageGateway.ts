import type {
  StorageGateway,
  UploadFileDTO,
} from "~/modules/chat/gateway/StorageGateway";

export class TestStorageGateway implements StorageGateway {
  async uploadFileAsync(dto: UploadFileDTO): Promise<string> {
    return `https://test-storage.example.com/${dto.key}`;
  }
}
