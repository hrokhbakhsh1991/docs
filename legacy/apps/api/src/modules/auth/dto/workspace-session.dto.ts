import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class WorkspaceSessionDto {
  @ApiProperty({
    format: "uuid",
    description: "Target tenant; caller must have an active user_tenants row for this tenant.",
    example: "11111111-1111-4111-8111-111111111111"
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsUUID()
  tenant_id!: string;
}
