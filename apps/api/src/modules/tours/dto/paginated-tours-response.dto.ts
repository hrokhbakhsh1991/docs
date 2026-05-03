import { ApiProperty } from "@nestjs/swagger";

import { TourResponseDto } from "./tour-response.dto";

export class PaginatedToursResponseDto {
  @ApiProperty({ type: [TourResponseDto] })
  items!: TourResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;
}
