import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumberString, IsString, IsUUID, Length } from "class-validator";

export class CreateManualPaymentDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  @IsNotEmpty()
  registrationId!: string;

  @ApiProperty({ example: "1200000" })
  @IsNumberString()
  @IsNotEmpty()
  amount!: string;

  @ApiProperty({ example: "IRR" })
  @IsString()
  @IsNotEmpty()
  @Length(3, 8)
  currency!: string;
}
