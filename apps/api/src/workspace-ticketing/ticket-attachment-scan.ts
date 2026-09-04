import { assertTicketAttachmentContentType } from "./ticket-attachment-storage";

export type TicketAttachmentScanInput = {
  readonly tenantId: string;
  readonly storageKey: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly originalFileName: string;
};

export type TicketAttachmentScanResult = "clean" | "rejected";

export type TicketAttachmentScanPort = {
  scan(input: TicketAttachmentScanInput): Promise<TicketAttachmentScanResult>;
};

/** EICAR standard antivirus test string — scanners must reject when present in payload. */
export const EICAR_TEST_STRING =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

let scanner: TicketAttachmentScanPort | null = null;

/**
 * V1 scanner: MIME allowlist gate (same set as upload intent).
 * Production can swap this port for an external malware engine without changing complete flow.
 */
export function createAllowlistTicketAttachmentScanner(): TicketAttachmentScanPort {
  return {
    async scan(input) {
      try {
        assertTicketAttachmentContentType(input.contentType);
        return "clean";
      } catch {
        return "rejected";
      }
    },
  };
}

export function getTicketAttachmentScanner(): TicketAttachmentScanPort {
  if (scanner === null) {
    scanner = createAllowlistTicketAttachmentScanner();
  }
  return scanner;
}

/** Tests only — inject rejecting or custom scanner. */
export function setTicketAttachmentScannerForTests(port: TicketAttachmentScanPort | null): void {
  scanner = port;
}
