import { ApiProperty } from "@nestjs/swagger";
import { TENANT_MODULE_IDS } from "@repo/shared";
import { ArrayUnique, IsArray, IsIn } from "class-validator";

export class PatchTenantModulesDto {
  @ApiProperty({
    type: [String],
    enum: TENANT_MODULE_IDS,
    example: ["finance", "form_builder"],
  })
  @IsArray()
  @ArrayUnique()
  @IsIn([...TENANT_MODULE_IDS], { each: true })
  enabledModules!: (typeof TENANT_MODULE_IDS)[number][];
}
