import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";
import { TENANT_SUBDOMAIN_REGEX } from "../../identity/entities/tenant.entity";

export class CreateWorkspaceDto {
  @ApiProperty({
    description: "Workspace display name",
    example: "Mountain Club"
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: "Workspace hostname label (slug/subdomain)",
    example: "mountain-club"
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  @Matches(TENANT_SUBDOMAIN_REGEX, {
    message:
      "subdomain must be lowercase, contain no spaces or dots, and use only letters, digits, and inner hyphens (DNS label)"
  })
  subdomain!: string;
}
