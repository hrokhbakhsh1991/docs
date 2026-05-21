import { ApiPropertyOptional } from "@nestjs/swagger";
import { WORKSPACE_REWARD_BADGE_IDS } from "@repo/shared";
import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min
} from "class-validator";

export class PostWorkspaceUserRewardsDto {
  @ApiPropertyOptional({
    example: 10,
    minimum: 0,
    maximum: 100,
    description: "Permanent discount percentage for this workspace membership (0–100)."
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  permanentDiscountPercentage?: number;

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
}
