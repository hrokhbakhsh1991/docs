import type { IncomingMessage } from "node:http";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { readBinaryRequestBody } from "../http/read-binary-body";
import {
  MEMBER_RECEIPT_PROOF_MAX_BYTES,
  putMemberReceiptProof,
  sanitizeReceiptProofFileName,
} from "./receipt-proof-storage";

function readHeader(req: IncomingMessage, name: string): string {
  const raw = req.headers[name.toLowerCase()];
  if (raw === undefined) {
    return "";
  }
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}

export async function uploadOperatorReceiptProof(input: {
  readonly req: IncomingMessage;
  readonly auth: TenantAuthContext;
  readonly registrationId: string;
}): Promise<{ readonly fileKey: string }> {
  const contentType = readHeader(input.req, "content-type");
  const fileNameHeader = readHeader(input.req, "x-receipt-file-name");
  const fileName =
    fileNameHeader.length > 0 ? sanitizeReceiptProofFileName(fileNameHeader) : "receipt.bin";
  const body = await readBinaryRequestBody(input.req, MEMBER_RECEIPT_PROOF_MAX_BYTES);
  const { storageKey } = await putMemberReceiptProof({
    tenantId: input.auth.tenantId,
    registrationId: input.registrationId,
    body,
    contentType,
    fileName,
  });
  return { fileKey: storageKey };
}
