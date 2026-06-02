import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DraftEventEntity } from "../entities/draft-event.entity";
import type { InsertDraftEventInput } from "../draft-event.types";

@Injectable()
export class TypeOrmDraftEventsRepository {
  constructor(
    @InjectRepository(DraftEventEntity)
    private readonly draftEventsRepository: Repository<DraftEventEntity>
  ) {}

  insert(input: InsertDraftEventInput): Promise<unknown> {
    return this.draftEventsRepository.insert({
      workspaceId: input.workspaceId,
      userId: input.userId,
      draftKey: input.draftKey,
      eventType: input.eventType,
      traceId: input.traceId,
      baseVersion: input.baseVersion,
      nextVersion: input.nextVersion,
      payloadSnapshot: input.payloadSnapshot as never,
    });
  }
}
