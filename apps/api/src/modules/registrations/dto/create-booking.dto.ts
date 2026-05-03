import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class CreateBookingDto {
  @ApiProperty({
    description: "Tour to register for (booking is tied directly to the tour)",
    example: "22222222-2222-4222-8222-222222222222"
  })
  @IsUUID()
  tourId!: string;
}
