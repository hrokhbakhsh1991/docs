import { Injectable } from "@nestjs/common";

import type { DraftSyncPayloadDto } from "./dto/draft-sync-payload.dto";
import {
  DraftEngineFacade,
  type DraftSyncPayloadResponse,
} from "./draft-engine.facade";

export type { DraftSyncPayloadResponse };

/**
 * @deprecated Prefer {@link DraftEngineFacade}. Thin delegate kept for module exports.
 */
@Injectable()
export class DraftEngineService {
  constructor(private readonly facade: DraftEngineFacade) {}

  findForMember(draftKey: string): Promise<DraftSyncPayloadResponse | null> {
    return this.facade.findForMember(draftKey);
  }

  upsertForMember(
    tenantId: string,
    draftKey: string,
    body: DraftSyncPayloadDto,
  ): Promise<DraftSyncPayloadResponse> {
    return this.facade.upsertForMember(tenantId, draftKey, body);
  }

  deleteForMember(draftKey: string): Promise<void> {
    return this.facade.deleteForMember(draftKey);
  }
}
