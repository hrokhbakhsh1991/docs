import { Type } from "class-transformer";
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

import { ReconciliationFindingStatus } from "../../finance/reconciliation/reconciliation-finding-status";

export class ListReconciliationFindingsQueryDto {
  @IsOptional()
  @IsEnum(ReconciliationFindingStatus)
  status?: ReconciliationFindingStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class AcknowledgeReconciliationFindingDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class ApplyReconciliationLedgerAdjustmentDto {
  @IsString()
  @MinLength(8)
  @MaxLength(191)
  idempotencyKey!: string;

  @IsString()
  amountMinor!: string;

  @IsIn(["credit_booking_wallet", "debit_booking_wallet"])
  flow!: "credit_booking_wallet" | "debit_booking_wallet";

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyOverride?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
