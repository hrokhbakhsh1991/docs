import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UserBookingTripRowDto {
  @ApiProperty({ example: "Denali Explorer Weekend" })
  tourTitle!: string;

  @ApiPropertyOptional({ example: "2026-06-15", description: "Departure date (ISO date)." })
  departureDate!: string | null;

  @ApiProperty({ example: "AcceptedPaid" })
  registrationStatus!: string;

  @ApiProperty({ example: "Paid" })
  paymentStatus!: string;
}
