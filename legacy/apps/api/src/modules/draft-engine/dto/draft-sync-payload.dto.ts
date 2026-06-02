import { ApiProperty } from "@nestjs/swagger";
import { DRAFT_SNAPSHOT_DEFAULT_SCHEMA_VERSION } from "@repo/shared-contracts";
import { IsInt, IsObject, IsOptional, Min } from "class-validator";

export class DraftSyncPayloadDto {
  @ApiProperty({ type: "object", additionalProperties: true })
  @IsObject()
  data!: Record<string, unknown>;

  @ApiProperty({ example: 1, description: "Optimistic concurrency version (0 for first create)" })
  @IsInt()
  @Min(0)
  version!: number;

  @ApiProperty({
    example: DRAFT_SNAPSHOT_DEFAULT_SCHEMA_VERSION,
    description: "Draft data blob schema generation",
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  schemaVersion?: number;

  @ApiProperty({ example: 1710000000000, description: "Client epoch milliseconds" })
  @IsInt()
  @Min(0)
  lastModified!: number;
}
