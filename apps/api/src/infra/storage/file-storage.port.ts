export const FILE_STORAGE_PORT = Symbol("FILE_STORAGE_PORT");

export interface FileUploadParams {
  workspaceId: string;
  relativePath: string;
  body: Buffer;
  contentType: string;
}

export interface FileStoragePort {
  upload(_params: FileUploadParams): Promise<{ key: string }>;
  getSignedUrl(_key: string, _expiresInSeconds: number): Promise<string>;
  /** Best-effort cleanup when DB persistence fails after upload. */
  deleteObject(_key: string): Promise<void>;
}
