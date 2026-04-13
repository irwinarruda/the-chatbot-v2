import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { R2Config } from "~/infra/config";
import type {
  IStorageGateway,
  UploadFileDTO,
} from "~/server/resources/IStorageGateway";

export class R2StorageGateway implements IStorageGateway {
  private client: S3Client;

  constructor(private config: R2Config) {
    this.client = new S3Client({
      region: "auto",
      endpoint: config.serviceUrl,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  async uploadFileAsync(dto: UploadFileDTO): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: dto.key,
        Body: dto.content,
        ContentType: dto.contentType,
      }),
    );
    return `${this.config.publicUrl}/${dto.key}`;
  }
}
