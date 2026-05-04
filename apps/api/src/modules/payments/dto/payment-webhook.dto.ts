import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { PaymentStatus } from "../entities/payment.entity";

export class PaymentWebhookDto {
  @ApiProperty({
    format: "uuid",
    example: "11111111-1111-4111-8111-111111111111",
    description: "Tenant metadata from provider payload."
  })
  @IsUUID()
  tenant_id!: string;

  @ApiPropertyOptional({ example: "evt-20260430-0001" })
  @IsOptional()
  @IsString()
  providerEventId?: string;

  @ApiProperty({ example: "mock-pay-001" })
  @IsString()
  providerPaymentId!: string;

  @ApiProperty({
    enum: [PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.REFUNDED, PaymentStatus.CANCELLED]
  })
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  @ApiPropertyOptional({ example: "gateway timeout" })
  @IsOptional()
  @IsString()
  reason?: string;
}
