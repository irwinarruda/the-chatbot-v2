import type {
  IStorageGateway,
  UploadFileDTO,
} from "~/server/resources/IStorageGateway";

export class TestStorageGateway implements IStorageGateway {
  async uploadFileAsync(dto: UploadFileDTO): Promise<string> {
    return `https://test-storage.example.com/${dto.key}`;
  }
}
