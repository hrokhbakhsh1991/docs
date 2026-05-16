import { ApiProperty } from "@nestjs/swagger";

/** CASL hydration slice for the active workspace membership (from ALS after auth). */
export class MembershipAbilityContextDto {
  @ApiProperty({
    type: [String],
    description:
      "Tenant-scoped membership labels (`user_tenants.labels`) used for capability aliases / marketing segments.",
    example: ["club_member"],
  })
  labels!: string[];

  @ApiProperty({
    type: [String],
    description:
      "Explicit capability grants when present on membership (future DB column); empty until wired.",
    example: [],
  })
  capabilities!: string[];

  @ApiProperty({
    type: [String],
    description:
      "Resolved effective capabilities (role ∪ metadata ∪ labels ∪ tenant modules) from DB hydration.",
    example: ["tour.read", "tour.update.core"],
  })
  effective_capabilities!: string[];

  @ApiProperty({
    type: [String],
    description:
      "Optional JWT `caps` claim snapshot at issuance (informational; re-login after capability changes).",
    example: ["tour.read", "tour.update.core"],
  })
  jwt_capability_snapshot!: string[];

  @ApiProperty({
    type: [String],
    description: "Region ids when actor has `tour.regional.manage` (from membership_metadata).",
    example: ["a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
  })
  allowed_region_ids!: string[];

  @ApiProperty({
    type: [String],
    description: "Enabled tenant product modules (`tenants.enabled_modules`).",
    example: ["finance"],
  })
  tenant_modules!: string[];
}
