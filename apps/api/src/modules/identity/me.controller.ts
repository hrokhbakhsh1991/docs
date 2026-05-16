import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  HttpCode,
  Patch,
  Post,
  Res,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath
} from "@nestjs/swagger";

import type { Response } from "express";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../../common/auth/user-role.enum";
import { RolesGuard } from "../auth/roles.guard";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { AbilityAction } from "../../common/casl/ability-actions";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { IdempotencyInterceptor } from "../idempotency/idempotency.interceptor";
import { Idempotent } from "../idempotency/idempotent.decorator";
import { ChangeMobileRequestDto } from "./dto/change-mobile-request.dto";
import { ChangeMobileVerifyDto } from "./dto/change-mobile-verify.dto";
import { MeChangeMobileChallengeResponseDto, MeMobileChangedResponseDto } from "./dto/me-mobile-response.dto";
import { MeEmailVerifiedResponseDto } from "./dto/me-email-verified-response.dto";
import { MePendingEmailVerificationResponseDto } from "./dto/me-pending-email-response.dto";
import { MeProfileResponseDto } from "./dto/me-profile-response.dto";
import { PatchMeDto } from "./dto/patch-me.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { MeService } from "./me.service";
import { resolveExpectedProfileRowVersionFromIfMatchHeader } from "./utils/profile-if-match";
import { patchMeDtoMutatesUserProfile } from "./utils/patch-me-profile-mutation";

@ApiTags("Me")
@Controller("api/v2/me")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@ApiBearerAuth()
@Roles(UserRole.Member, UserRole.Owner, UserRole.Admin, UserRole.Leader, UserRole.Viewer)
export class MeController {
  /** Explicit token: Nest+tsx test bootstrap can omit constructor DI for custom `MeService` provider without this. */
  constructor(@Inject(MeService) private readonly meService: MeService) {}

  @Get()
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Workspace"))
  @ApiOperation({ summary: "Current user profile in workspace context" })
  @ApiOkResponse({ type: MeProfileResponseDto })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Tenant mismatch or no membership" })
  async getMe(@Res({ passthrough: true }) res: Response) {
    const profile = await this.meService.getMe();
    res.setHeader("ETag", `W/"${String(profile.profile_row_version)}"`);
    res.setHeader("Cache-Control", "private, no-store");
    return profile;
  }

  @Patch()
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Workspace"))
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    endpoint: "/api/v2/me",
    statusCode: 200,
    required: false,
    tenantSource: "context"
  })
  @ApiHeader({
    name: "If-Match",
    required: false,
    description:
      'Weak concurrency check from GET `ETag` (e.g. `W/"3"` equals `profile_row_version`). Required (or send `expected_profile_row_version`) when changing profile fields.'
  })
  @ApiHeader({
    name: "Idempotency-Key",
    required: false,
    description: "Optional replay protection for identical PATCH payloads (tenant-scoped, 24h default TTL)."
  })
  @ApiOperation({ summary: "Update profile fields and/or start email change verification" })
  @ApiBody({ type: PatchMeDto })
  @ApiExtraModels(MeProfileResponseDto, MePendingEmailVerificationResponseDto)
  @ApiOkResponse({
    description: "Updated profile, or pending verification when email changes",
    schema: {
      oneOf: [
        { $ref: getSchemaPath(MeProfileResponseDto) },
        { $ref: getSchemaPath(MePendingEmailVerificationResponseDto) }
      ]
    }
  })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Tenant mismatch or no membership" })
  async patchMe(
    @Headers("if-match") ifMatch: string | string[] | undefined,
    @Body() dto: PatchMeDto
  ) {
    let expectedVersion: number | undefined = resolveExpectedProfileRowVersionFromIfMatchHeader(ifMatch);

    const bodyExpected = dto.expected_profile_row_version;
    if (bodyExpected !== undefined) {
      if (expectedVersion !== undefined && Number(bodyExpected) !== Number(expectedVersion)) {
        throw new BadRequestException({
          error: {
            code: "VALIDATION_FIELD_FORMAT_INVALID",
            message: "`If-Match` and expected_profile_row_version disagree — send only one, or identical values."
          }
        });
      }
      expectedVersion = Number(bodyExpected);
    }

    if (patchMeDtoMutatesUserProfile(dto) && expectedVersion === undefined) {
      throw new BadRequestException({
        error: {
          code: "PROFILE_ROW_VERSION_REQUIRED",
          message:
            "Send If-Match (from GET /me ETag) or expected_profile_row_version matching profile_row_version before changing profile fields."
        }
      });
    }

    return this.meService.patchMe(dto, { expectedProfileRowVersion: expectedVersion });
  }

  @Post("verify-email")
  @HttpCode(200)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Workspace"))
  @ApiOperation({ summary: "Complete email change with verification token" })
  @ApiBody({ type: VerifyEmailDto })
  @ApiOkResponse({ type: MeEmailVerifiedResponseDto })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Tenant mismatch or no membership" })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.meService.verifyEmail(dto.token);
  }

  @Post("change-mobile/request")
  @HttpCode(200)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Workspace"))
  @ApiOperation({ summary: "Start mobile change (sends OTP)" })
  @ApiBody({ type: ChangeMobileRequestDto })
  @ApiOkResponse({ type: MeChangeMobileChallengeResponseDto })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Tenant mismatch or no membership" })
  async requestChangeMobile(@Body() dto: ChangeMobileRequestDto) {
    return this.meService.requestChangeMobile(dto.new_mobile);
  }

  @Post("change-mobile/verify")
  @HttpCode(200)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Workspace"))
  @ApiOperation({ summary: "Complete mobile change with OTP" })
  @ApiBody({ type: ChangeMobileVerifyDto })
  @ApiOkResponse({ type: MeMobileChangedResponseDto })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "Tenant mismatch or no membership" })
  async verifyChangeMobile(@Body() dto: ChangeMobileVerifyDto) {
    return this.meService.verifyChangeMobile(dto.challenge_id, dto.code);
  }
}
