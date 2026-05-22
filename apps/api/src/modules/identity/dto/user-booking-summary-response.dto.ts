import { ApiProperty } from "@nestjs/swagger";

export class UserBookingSummaryResponseDto {
  @ApiProperty({ example: 12, description: "All tenant-scoped registrations matched to this user." })
  totalTrips!: number;

  @ApiProperty({
    example: 8,
    description:
      "Registrations whose status is not Cancelled/Rejected/NoShow and whose departure date is before today (UTC)."
  })
  completedTrips!: number;

  @ApiProperty({
    example: 2,
    description: "Registrations with status Cancelled or Rejected."
  })
  cancelledTrips!: number;
}
