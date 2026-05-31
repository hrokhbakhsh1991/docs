import { ApiProperty } from "@nestjs/swagger";

export class TourPhotoUrlResponseDto {
  @ApiProperty({ description: "Short-lived presigned GET URL (15-minute TTL)" })
  url!: string;

  @ApiProperty({ example: 900, description: "Presigned URL lifetime in seconds" })
  expiresInSeconds!: number;
}
