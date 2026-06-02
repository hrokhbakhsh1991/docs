import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { AbilityAction } from "../../common/casl/ability-actions";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { UserRole } from "../../common/auth/user-role.enum";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { TourPhotoUrlResponseDto } from "./dto/tour-photo-url-response.dto";
import { TourPhotoUrlService } from "./services/tour-photo-url.service";
import { ToursCatalogReadApplicationService } from "./application/tours-catalog-read.application.service";

@ApiTags("Tours")
@Controller("api/v2/workspaces")
@ApiBearerAuth()
export class WorkspaceTourPhotosController {
  constructor(
    @Inject(TourPhotoUrlService) private readonly tourPhotoUrlService: TourPhotoUrlService,
    @Inject(ToursCatalogReadApplicationService)
    private readonly toursCatalogRead: ToursCatalogReadApplicationService,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
  ) {}

  @Get(":tenantId/tours/:tourId/photos/:photoId/url")
  @ApiOperation({ summary: "Resolve a short-lived presigned URL for a tour gallery photo" })
  @ApiParam({ name: "tenantId", format: "uuid" })
  @ApiParam({ name: "tourId", format: "uuid" })
  @ApiParam({ name: "photoId", format: "uuid" })
  @ApiOkResponse({ type: TourPhotoUrlResponseDto })
  @UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
  @Roles(UserRole.Member, UserRole.Owner, UserRole.Admin, UserRole.Leader, UserRole.Viewer)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Tour"))
  async getPhotoUrl(
    @Param("tenantId", new ParseUUIDPipe()) tenantId: string,
    @Param("tourId", new ParseUUIDPipe()) tourId: string,
    @Param("photoId", new ParseUUIDPipe()) photoId: string,
  ): Promise<TourPhotoUrlResponseDto> {
    const contextTenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!contextTenantId || contextTenantId !== tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "Access to tenant denied",
        },
      });
    }

    const tour = await this.toursCatalogRead.getTourEntityById(tourId);
    return this.tourPhotoUrlService.getPhotoPresignedUrl(
      tenantId,
      tourId,
      tour.details?.tripDetails ?? null,
      photoId,
    );
  }
}
