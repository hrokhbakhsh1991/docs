import { Injectable } from "@nestjs/common";
import { FileStoragePort, FileUploadParams } from "../../src/infra/storage/file-storage.port";

/** Test double for {@link FileStoragePort} — no MinIO required. */
@Injectable()
export class InMemoryFileStorageAdapter implements FileStoragePort {
  private readonly objects = new Map<string, Buffer>();

  async upload(params: FileUploadParams): Promise<{ key: string }> {
    const key = `${params.workspaceId}/${params.relativePath}`;
    this.objects.set(key, params.body);
    return { key };
  }

  async getSignedUrl(key: string, _expiresInSeconds: number): Promise<string> {
    if (!this.objects.has(key)) {
      throw new Error(`InMemoryFileStorageAdapter: missing object ${key}`);
    }
    return `memory://receipts/${key}`;
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async deleteObjectsByPrefix(prefix: string): Promise<void> {
    const normalized = prefix.trim();
    if (normalized === "") {
      return;
    }
    for (const key of [...this.objects.keys()]) {
      if (key.startsWith(normalized)) {
        this.objects.delete(key);
      }
    }
  }
}
