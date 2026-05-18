export const FILE_STORAGE_PORT = Symbol("FILE_STORAGE_PORT");

export interface FileUploadParams {
  workspaceId: string;
  relativePath: string;
  body: Buffer;
  contentType: string;
}

export interface FileStoragePort {
  upload(params: FileUploadParams): Promise<{ key: string }>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  /** Best-effort cleanup when DB persistence fails after upload. */
  deleteObject(key: string): Promise<void>;
}
