import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class CreatePaymentIntentDto {
  @ApiProperty({ example: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })
  @IsUUID()
  registrationId!: string;

  @ApiProperty({ example: 2500000 })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({ example: "IRR" })
  @IsString()
  currency!: string;

  @ApiProperty({ example: "mock_provider" })
  @IsString()
  provider!: string;

  @ApiProperty({ example: "mock-pay-001", required: false, nullable: true })
  @IsOptional()
  @IsString()
  providerPaymentId?: string;
}
