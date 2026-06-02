import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PaymentStatus, PaymentMethod } from "../domain/payment.types";

export class PaymentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  registrationId!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ enum: PaymentMethod })
  method!: PaymentMethod;

  @ApiProperty()
  provider!: string;

  @ApiProperty({ type: String, nullable: true })
  providerPaymentId!: string | null;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ type: String, nullable: true })
  paidAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  failedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  refundedAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: "Stripe PaymentIntent client secret when applicable." })
  clientSecret?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Hosted checkout URL (e.g. Zibal) when applicable."
  })
  checkoutUrl?: string | null;
}
