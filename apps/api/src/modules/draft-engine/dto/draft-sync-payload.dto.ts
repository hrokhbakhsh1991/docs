import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsObject, Min } from "class-validator";

export class DraftSyncPayloadDto {
  @ApiProperty({ type: "object", additionalProperties: true })
  @IsObject()
  data!: Record<string, unknown>;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  version!: number;

  @ApiProperty({ example: 1710000000000, description: "Client epoch milliseconds" })
  @IsInt()
  @Min(0)
  lastModified!: number;
}
