import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";

export class EmergencyContactItemDto {
  @ApiProperty({ example: "Jane Doe" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName!: string;

  @ApiProperty({ example: "+14155552671" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phoneE164!: string;

  @ApiProperty({ example: "spouse" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  relationship!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ReplaceEmergencyContactsDto {
  @ApiProperty({ type: [EmergencyContactItemDto], maxItems: 20 })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactItemDto)
  contacts!: EmergencyContactItemDto[];
}

export class UpsertMedicalProfileDto {
  @ApiProperty({
    description: "UTF-8 JSON string of medical fields (encrypted at rest server-side). Never logged.",
    example: '{"allergies":[],"medications":[]}'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32_768)
  plaintextPayloadUtf8!: string;
}
