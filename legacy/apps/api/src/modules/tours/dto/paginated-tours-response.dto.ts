import { ApiProperty } from "@nestjs/swagger";

import { TourResponseDto } from "./tour-response.dto";

export class PaginatedToursResponseDto {
  @ApiProperty({ type: [TourResponseDto] })
  items!: TourResponseDto[];

  @ApiProperty({
    example: 42,
    description: "Total matching rows, or -1 when include_total=false on the list request"
  })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;
}
