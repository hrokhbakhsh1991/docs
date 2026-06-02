import {
  Controller,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { WorkspaceAbilityFactoryService } from "../../../common/casl/workspace-ability.factory.service";
import { AuthorizationPresenceGuard } from "../../auth/authorization-presence.guard";
import { Roles } from "../../auth/roles.decorator";
import { UserRole } from "../../../common/auth/user-role.enum";
import { RolesGuard } from "../../auth/roles.guard";
import { AbilitiesGuard } from "../../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../../common/casl/casl-mirror-abilities.guard";
import { AbilityAction } from "../../../common/casl/ability-actions";
import { CheckAbilities } from "../../../common/casl/check-abilities.decorator";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { IdempotencyInterceptor } from "../../idempotency/repositories/idempotency.interceptor";
import { Idempotent } from "../../idempotency/idempotent.decorator";
import { TourResponseDto } from "../dto/tour-response.dto";
import { ToursCloneService } from "../services/tours-clone.service";
import { TourLifecycleStatus } from "@repo/domain-contracts";
import { assertTourCreateWritePreMerge } from "../policies/assert-tour-create-write-pipeline";
import { CreateTourDto } from "../dto/create-tour.dto";

@ApiTags("Tours")
@Controller("api/v2/tours")
export class ToursCloneController {
  constructor(
    @Inject(ToursCloneService) private readonly toursCloneService: ToursCloneService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
    @Inject(WorkspaceAbilityFactoryService)
    private readonly abilityFactory: WorkspaceAbilityFactoryService,
  ) {}

  @Post("clone/:sourceTourId")
  @ApiBearerAuth()
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "Required idempotency key for clone mutation.",
  })
  @ApiOperation({
    summary: "Clone tour (server-side)",
    description:
      "Deep-clones trip_details via the workspace template orchestrator. Does not accept a wizard form payload.",
  })
  @ApiCreatedResponse({ type: TourResponseDto })
  @UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard, ThrottlerGuard)
  @Throttle({ "tour-create": { ttl: 60_000, limit: 30 } })
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Leader)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Create, "Tour"))
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    endpoint: "/api/v2/tours/clone",
    statusCode: 201,
    required: true,
    tenantSource: "context",
    hashMode: "tour-clone-source",
  })
  async cloneTour(
    @Param("sourceTourId", ParseUUIDPipe) sourceTourId: string,
  ): Promise<TourResponseDto> {
    const workspaceId = this.requestContext.resolveEffectiveTenantId();
    const abilityProbe = new CreateTourDto();
    abilityProbe.title = "Server-side tour clone ability probe";
    abilityProbe.total_capacity = 1;
    abilityProbe.lifecycle_status = TourLifecycleStatus.DRAFT;
    assertTourCreateWritePreMerge({
      ability: this.abilityFactory.createForActiveRequest(),
      dto: abilityProbe,
    });
    return this.toursCloneService.cloneTour(sourceTourId, {
      targetWorkspaceId: workspaceId ?? "",
    });
  }
}
