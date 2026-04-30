import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested
} from "class-validator";

export class WebCredentialDto {
  @ApiProperty({
    example: "leader@example.com",
    description: "User email address for web login"
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: "Passw0rd!",
    description: "Plain text password for authentication"
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class WebSessionDto {
  @ApiProperty({
    example: "web",
    enum: ["web"]
  })
  @IsIn(["web"])
  entry_mode!: "web";

  @ApiProperty({
    type: WebCredentialDto
  })
  @ValidateNested()
  @Type(() => WebCredentialDto)
  credential!: WebCredentialDto;

  @ApiPropertyOptional({
    example: "11111111-1111-4111-8111-111111111111",
    description: "Optional tenant assertion from trusted client context"
  })
  @IsOptional()
  @IsUUID()
  asserted_tenant_id?: string;
}
