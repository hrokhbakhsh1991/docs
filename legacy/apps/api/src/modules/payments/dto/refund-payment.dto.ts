import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class RefundPaymentDto {
  @ApiPropertyOptional({ example: "operator initiated refund" })
  @IsOptional()
  @IsString()
  reason?: string;
}
