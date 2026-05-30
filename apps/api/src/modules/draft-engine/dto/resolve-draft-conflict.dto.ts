import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ValidateNested } from "class-validator";
import { DraftSyncPayloadDto } from "./draft-sync-payload.dto";

export class ResolveDraftConflictDto {
  @ApiProperty({ type: DraftSyncPayloadDto, description: "Client-side draft state that conflicted with the server" })
  @ValidateNested()
  @Type(() => DraftSyncPayloadDto)
  clientDraft!: DraftSyncPayloadDto;
}
