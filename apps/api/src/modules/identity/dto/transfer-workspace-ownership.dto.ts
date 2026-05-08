import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class TransferWorkspaceOwnershipDto {
  @ApiProperty({
    format: "uuid",
    example: "7f9a71aa-5fae-4da5-99dd-ef0bd19f1e1c",
    description: "Existing active workspace member that will become the new owner."
  })
  @IsUUID()
  newOwnerUserId!: string;
}

export class TransferWorkspaceOwnershipResponseDto {
  @ApiProperty({ format: "uuid" })
  tenant_id!: string;

  @ApiProperty({ format: "uuid" })
  previous_owner_user_id!: string;

  @ApiProperty({ format: "uuid" })
  new_owner_user_id!: string;
}
