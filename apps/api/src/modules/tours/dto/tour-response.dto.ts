import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TourResponseDto {
  @ApiProperty({ example: "22222222-2222-4222-8222-222222222222" })
  id!: string;

  @ApiProperty({ example: "Spring Camp 2026" })
  title!: string;

  @ApiPropertyOptional({ example: "A two-day nature tour for members.", nullable: true })
  description?: string;

  @ApiProperty({ example: 30 })
  totalCapacity!: number;

  @ApiProperty({ example: 10 })
  acceptedCount!: number;

  @ApiPropertyOptional({
    example: { currency: "IRR", requiresPayment: true },
    nullable: true,
    type: "object",
    additionalProperties: true
  })
  costContext?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: "2026-05-01T08:00:00.000Z",
    nullable: true,
    description: "Reserved for forward-compatible schedule projection; may be absent."
  })
  startDate?: string | null;

  @ApiPropertyOptional({
    example: "2026-05-01T20:00:00.000Z",
    nullable: true,
    description: "Reserved for forward-compatible schedule projection; may be absent."
  })
  endDate?: string | null;
}
