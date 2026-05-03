import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PaymentResponseDto } from "../../payments/dto/payment-response.dto";
import { RegistrationResponseDto } from "./get-registration.dto";

export class PublicRegistrationResponseDto {
  @ApiPropertyOptional({ type: RegistrationResponseDto, nullable: true })
  registration!: RegistrationResponseDto | null;

  @ApiPropertyOptional({ type: PaymentResponseDto, nullable: true })
  paymentIntent!: PaymentResponseDto | null;

  @ApiPropertyOptional({ example: "44444444-4444-4444-8444-444444444444", nullable: true })
  waitlistItemId?: string | null;

  @ApiPropertyOptional({ example: 2, nullable: true })
  waitlistPosition!: number | null;
}

export class PublicWaitlistResponseDto {
  @ApiProperty({ example: "44444444-4444-4444-8444-444444444444" })
  waitlistItemId!: string;

  @ApiProperty({ example: 2 })
  queuePosition!: number;
}
