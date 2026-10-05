import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { putMemberReceiptProof } from "./receipt-proof-storage";

const STORAGE_ENV_KEYS = [
  "MINIO_ENDPOINT",
  "MINIO_ACCESS_KEY",
  "MINIO_SECRET_KEY",
  "MINIO_BUCKET",
  "MINIO_PUBLIC_ENDPOINT",
] as const;

function snapshotStorageEnv(): Map<string, string | undefined> {
  return new Map(STORAGE_ENV_KEYS.map((key) => [key, process.env[key]]));
}

function clearMinioEnv(): void {
  for (const key of STORAGE_ENV_KEYS) {
    delete process.env[key];
  }
}

describe("receipt proof storage driver boundary", () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorNodeEnv = process.env.NODE_ENV;
  const priorMinioEnv = snapshotStorageEnv();

  afterEach(() => {
    if (priorStorageDriver === undefined) delete process.env.STORAGE_DRIVER;
    else process.env.STORAGE_DRIVER = priorStorageDriver;
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorNodeEnv;
    for (const key of STORAGE_ENV_KEYS) {
      const value = priorMinioEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("does not silently use process memory for a non-memory driver", async () => {
    process.env.STORAGE_DRIVER = "prisma";
    process.env.NODE_ENV = "staging";
    clearMinioEnv();

    await assert.rejects(
      () =>
        putMemberReceiptProof({
          tenantId: "tenant-denali",
          registrationId: "registration-1",
          body: Buffer.from("receipt"),
          contentType: "image/png",
          fileName: "receipt.png",
        }),
      (error: unknown) => error instanceof Error && error.message === "MINIO_NOT_CONFIGURED"
    );
  });
});
