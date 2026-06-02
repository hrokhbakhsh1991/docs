import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class OtpRequestDto {
  @ApiProperty({ example: "+989121234567" })
  @IsString()
  @IsNotEmpty()
  phone!: string;
}
