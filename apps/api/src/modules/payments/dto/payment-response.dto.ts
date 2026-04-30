import { ApiProperty } from "@nestjs/swagger";
import { PaymentStatus } from "../entities/payment.entity";

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

  @ApiProperty()
  provider!: string;

  @ApiProperty({ nullable: true })
  providerPaymentId!: string | null;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ nullable: true })
  paidAt!: string | null;

  @ApiProperty({ nullable: true })
  failedAt!: string | null;

  @ApiProperty({ nullable: true })
  refundedAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
