import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { PaymentStatus } from "../entities/payment.entity";

export class PaymentWebhookDto {
  @ApiPropertyOptional({ example: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })
  @IsOptional()
  @IsString()
  paymentId?: string;

  @ApiPropertyOptional({ example: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })
  @IsOptional()
  @IsString()
  registrationId?: string;

  @ApiPropertyOptional({ example: "11111111-1111-4111-8111-111111111111" })
  @IsOptional()
  @IsString()
  tenantId?: string;

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
