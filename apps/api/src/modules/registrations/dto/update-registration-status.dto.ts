import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, Min } from "class-validator";
import { RegistrationStatus } from "../domain/registration-status";

export class UpdateRegistrationStatusDto {
  @ApiProperty({
    description: "Target registration status",
    enum: RegistrationStatus,
    example: RegistrationStatus.ACCEPTED
  })
  @IsEnum(RegistrationStatus)
  targetStatus!: RegistrationStatus;

  @ApiProperty({
    description:
      "Optimistic concurrency token from `GET /api/v2/registrations/:id` (`rowVersion` / `registrations.row_version`). Must match the row at apply time.",
    example: 1,
    minimum: 1
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expected_row_version!: number;
}
