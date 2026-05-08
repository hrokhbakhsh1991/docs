import { ApiProperty } from "@nestjs/swagger";
import { UserResponseDto } from "./user-response.dto";

export class ListUsersResponseDto {
  @ApiProperty({ type: UserResponseDto, isArray: true })
  data!: UserResponseDto[];

  @ApiProperty({
    nullable: true,
    description: "Opaque cursor for the next page; null when no more rows",
    example: "eyJjcmVhdGVkQXQiOiIyMDI2LTA1LTA1VDA4OjAwOjAwLjAwMFoiLCJpZCI6IjExMTExMTExLTExMTEtNDExMS04MTExLTExMTExMTExMTExMSJ9"
  })
  nextCursor!: string | null;
}
