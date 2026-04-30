import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class RefundPaymentDto {
  @ApiProperty({ required: false, example: "operator initiated refund" })
  @IsOptional()
  @IsString()
  reason?: string;
}
