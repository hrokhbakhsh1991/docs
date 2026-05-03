import { ApiProperty } from "@nestjs/swagger";

export class UserResponseDto {
  @ApiProperty({ example: "11111111-1111-4111-8111-111111111111" })
  id!: string;

  @ApiProperty({ example: "Ava Chen" })
  name!: string;

  @ApiProperty({ example: "ava.chen@example.com" })
  email!: string;

  @ApiProperty({ example: "owner", description: "Tenant-scoped role from user_tenants.role" })
  role!: string;

  @ApiProperty({ example: "Active", enum: ["Active", "Invited"] })
  status!: "Active" | "Invited";
}
