import { ApiPropertyOptional } from "@nestjs/swagger";
import { WORKSPACE_REWARD_BADGE_IDS } from "@repo/shared";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf
} from "class-validator";

export class PostWorkspaceUserRewardsDto {
  @ApiPropertyOptional({
    example: 10,
    minimum: 0,
    maximum: 100,
    description: "Permanent discount percentage for this workspace membership (0–100)."
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  permanentDiscountPercentage?: number | null;

  @ApiPropertyOptional({
    example: ["VIP_MEMBER", "LEADER_BUDDY"],
    enum: WORKSPACE_REWARD_BADGE_IDS,
    isArray: true,
    description: "Reward badge tags stored on membership metadata."
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn([...WORKSPACE_REWARD_BADGE_IDS], { each: true })
  badges?: string[];

  @ApiPropertyOptional({
    description: "Tour leader picker eligibility (`capability.is_selectable_leader` micro-capability)."
  })
  @IsOptional()
  @IsBoolean()
  isSelectableLeader?: boolean;

  @ApiPropertyOptional({
    type: [String],
    example: ["vip_client", "repeat_guest"],
    description: "CRM labels stored on `user_tenants.labels` (replaces array when provided)."
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @ArrayMaxSize(32)
  labels?: string[];
}
