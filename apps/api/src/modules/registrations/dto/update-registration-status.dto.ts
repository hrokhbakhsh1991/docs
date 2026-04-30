import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { RegistrationStatus } from "../registration.entity";

export class UpdateRegistrationStatusDto {
  @ApiProperty({
    description: "Target registration status",
    enum: RegistrationStatus,
    example: RegistrationStatus.ACCEPTED
  })
  @IsEnum(RegistrationStatus)
  targetStatus!: RegistrationStatus;
}
