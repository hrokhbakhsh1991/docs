import { ConflictException } from "@nestjs/common";

import type { DraftSyncPayloadResponse } from "./draft-engine.facade";

/** Thrown when PATCH `version` does not match the stored draft (optimistic concurrency). */
export class DraftConflictException extends ConflictException {
  constructor(server: DraftSyncPayloadResponse) {
    super({
      error: {
        code: "DRAFT_CONFLICT",
        message: "Stale draft version",
        details: { server },
      },
    });
  }
}
