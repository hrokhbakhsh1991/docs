import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsNumber, IsOptional, Min } from "class-validator";
import { RegistrationPaymentStatus } from "../registration.entity";

const PUBLIC_PAYMENT_STATUS_VALUES = [
  RegistrationPaymentStatus.NOT_PAID,
  RegistrationPaymentStatus.PARTIAL,
  RegistrationPaymentStatus.PAID
] as const;

export class UpdateRegistrationPaymentDto {
  @ApiProperty({
    description: "Target payment status",
    enum: PUBLIC_PAYMENT_STATUS_VALUES,
    example: RegistrationPaymentStatus.PARTIAL
  })
  @IsIn(PUBLIC_PAYMENT_STATUS_VALUES)
  paymentStatus!: RegistrationPaymentStatus;

  @ApiPropertyOptional({
    description: "Optional paid amount (non-negative)",
    example: 2500000,
    minimum: 0
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @ApiProperty({
    description:
      "Optimistic concurrency token from `GET /api/v2/registrations/:id` (`rowVersion`). Must match the row at apply time.",
    example: 1,
    minimum: 1
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expected_row_version!: number;
}
