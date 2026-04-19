export interface UploadFileDTO {
  key: string;
  content: Buffer;
  contentType: string;
}

export interface IStorageGateway {
  uploadFileAsync(dto: UploadFileDTO): Promise<string>;
}
