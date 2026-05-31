import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import * as Minio from "minio";
import { ConfigService } from "../../config/config.service";
import { FileStoragePort, FileUploadParams } from "./file-storage.port";

@Injectable()
export class MinioStorageAdapter implements FileStoragePort, OnModuleInit {
  private readonly client: Minio.Client;
  private readonly bucket: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const minioConfig = config.getMinioConfig();
    this.client = new Minio.Client({
      endPoint: minioConfig.endPoint,
      port: minioConfig.port,
      useSSL: minioConfig.useSSL,
      accessKey: minioConfig.accessKey,
      secretKey: minioConfig.secretKey
    });
    this.bucket = minioConfig.bucket;
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
      }
    } catch (err) {
      if (process.env.NODE_ENV === "test") {
        return;
      }
      throw err;
    }
  }

  async upload(params: FileUploadParams): Promise<{ key: string }> {
    const key = `${params.workspaceId}/${params.relativePath}`;
    await this.client.putObject(this.bucket, key, params.body, params.body.length, {
      "Content-Type": params.contentType
    });
    return { key };
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expiresInSeconds);
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, key);
    } catch {
      /* best-effort */
    }
  }

  async deleteObjectsByPrefix(prefix: string): Promise<void> {
    const normalized = prefix.trim();
    if (normalized === "") {
      return;
    }
    try {
      const keys: string[] = [];
      const stream = this.client.listObjectsV2(this.bucket, normalized, true);
      await new Promise<void>((resolve, reject) => {
        stream.on("data", (obj) => {
          if (obj.name) {
            keys.push(obj.name);
          }
        });
        stream.on("error", reject);
        stream.on("end", resolve);
      });
      if (keys.length === 0) {
        return;
      }
      await this.client.removeObjects(this.bucket, keys);
    } catch {
      /* best-effort */
    }
  }

  /** Used by {@link StorageHealthService} — does not mutate bucket state. */
  async ping(): Promise<{ ok: true; bucket: string } | { ok: false; bucket: string; reason?: string }> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        return { ok: false, bucket: this.bucket, reason: "bucket_missing" };
      }
      return { ok: true, bucket: this.bucket };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown_error";
      return { ok: false, bucket: this.bucket, reason };
    }
  }
}
