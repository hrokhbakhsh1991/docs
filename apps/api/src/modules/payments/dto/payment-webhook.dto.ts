import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { PaymentStatus } from "../entities/payment.entity";

export class PaymentWebhookDto {
  @ApiProperty({ example: "mock-pay-001" })
  @IsString()
  providerPaymentId!: string;

  @ApiProperty({
    enum: [PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.REFUNDED, PaymentStatus.CANCELLED]
  })
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  @ApiProperty({ required: false, example: "gateway timeout" })
  @IsOptional()
  @IsString()
  reason?: string;
}
