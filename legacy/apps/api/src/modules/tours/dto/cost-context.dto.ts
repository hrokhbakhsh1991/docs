import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsNumberString, IsOptional, IsString, Length, MaxLength } from "class-validator";

/** Denali pilot payment channel (offline receipt only). */
export const TOUR_PAYMENT_MODE_VALUES = ["offline_receipt"] as const;
export type TourPaymentMode = (typeof TOUR_PAYMENT_MODE_VALUES)[number];

/**
 * Whitelisted `cost_context` JSONB fields for create/update (avoids silent strip of structured pricing).
 * Extra keys are still removed at the HTTP boundary when nested validation is enabled.
 */
export class CostContextDto {
  @ApiPropertyOptional({ example: "USD", description: "ISO 4217 alpha code when set." })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: "1200", description: "Major-unit amount as decimal string (no float ingress)." })
  @IsOptional()
  @IsNumberString()
  totalCost?: string;

  @ApiPropertyOptional({ description: "Display / billing location hint until a dedicated column exists." })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  location?: string;

  @ApiPropertyOptional({
    example: true,
    description: "Force payment intent creation at registration for this tour. Requires module.finance capability."
  })
  @IsOptional()
  @IsBoolean()
  requiresPayment?: boolean;

  @ApiPropertyOptional({
    enum: [...TOUR_PAYMENT_MODE_VALUES],
    description: "Denali pilot: offline receipt only (no online gateway)."
  })
  @IsOptional()
  @IsIn([...TOUR_PAYMENT_MODE_VALUES])
  paymentMode?: TourPaymentMode;
}
