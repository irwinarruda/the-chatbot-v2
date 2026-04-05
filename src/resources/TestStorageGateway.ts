import type {
  IStorageGateway,
  UploadFileDTO,
} from "~/resources/IStorageGateway";

export class TestStorageGateway implements IStorageGateway {
  async uploadFileAsync(dto: UploadFileDTO): Promise<string> {
    return `https://test-storage.example.com/${dto.key}`;
  }
}
