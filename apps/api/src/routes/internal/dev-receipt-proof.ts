import type { IncomingMessage, ServerResponse } from "node:http";

import { assertProvisioningDevelopmentOnly } from "../../internal/provisioning-guard";
import { readMemoryReceiptProof } from "../../workspace-finance/receipt-proof-storage";

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

function guessContentType(storageKey: string): string {
  const dotIndex = storageKey.lastIndexOf(".");
  const extension = dotIndex >= 0 ? storageKey.slice(dotIndex).toLowerCase() : "";
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? "application/octet-stream";
}

/**
 * Dev-only route (`STORAGE_DRIVER=memory`) that serves the bytes a local
 * receipt upload wrote into the in-process memory store. Production/staging
 * use real MinIO presigned URLs and never hit this handler — it exists solely
 * so a developer running the app locally can actually see the uploaded
 * receipt image on the operator finance review screen instead of a permanent
 * "receipt not available" placeholder.
 */
export async function handleDevReceiptProof(
  _req: IncomingMessage,
  res: ServerResponse,
  storageKeyParam: string
): Promise<void> {
  try {
    assertProvisioningDevelopmentOnly();
  } catch {
    res.writeHead(404).end();
    return;
  }

  if (process.env.STORAGE_DRIVER !== "memory") {
    res.writeHead(404).end();
    return;
  }

  const storageKey = decodeURIComponent(storageKeyParam);
  const bytes = readMemoryReceiptProof(storageKey);
  if (bytes === null) {
    res.writeHead(404).end();
    return;
  }

  res.writeHead(200, {
    "Content-Type": guessContentType(storageKey),
    "Content-Length": bytes.length,
    "Cache-Control": "private, max-age=60",
  });
  res.end(bytes);
}
