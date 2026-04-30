import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min
} from "class-validator";

export class CreatePaymentIntentDto {
  @ApiProperty({ example: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })
  @IsDefined()
  @IsNotEmpty()
  @IsUUID()
  registrationId!: string;

  @ApiProperty({ example: 2500000 })
  @IsDefined()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({ example: "IRR" })
  @IsDefined()
  @IsNotEmpty()
  @IsString()
  currency!: string;

  @ApiProperty({ example: "mock_provider" })
  @IsDefined()
  @IsNotEmpty()
  @IsString()
  provider!: string;

  @ApiPropertyOptional({ example: "mock-pay-001", nullable: true })
  @IsOptional()
  @IsString()
  providerPaymentId?: string;
}
