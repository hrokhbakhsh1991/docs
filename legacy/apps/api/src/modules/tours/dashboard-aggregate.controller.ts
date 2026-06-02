import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../../common/auth/user-role.enum";
import { RolesGuard } from "../auth/roles.guard";
import { AbilitiesGuard } from "../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../common/casl/casl-mirror-abilities.guard";
import { AbilityAction } from "../../common/casl/ability-actions";
import { CheckAbilities } from "../../common/casl/check-abilities.decorator";
import { RegistrationsService } from "../registrations/registrations.service";
import { ToursService } from "./tours.service";
import type { TourResponseDto } from "./dto/tour-response.dto";

@ApiTags("Dashboard")
@Controller("api/v2/dashboard")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@ApiBearerAuth()
export class DashboardAggregateController {
  constructor(
    private readonly toursService: ToursService,
    private readonly registrationsService: RegistrationsService,
  ) {}

  @Get("leader-workspace")
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Leader)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Tour"))
  @ApiOperation({
    summary: "Leader workspace aggregate",
    description: "Returns first-page tenant tours for dashboard aggregates."
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Max tours returned for aggregate payload",
    schema: { default: 200, minimum: 1, maximum: 500 }
  })
  async getLeaderWorkspaceAggregate(
    @Query("limit") limitRaw?: string
  ): Promise<{ tours: TourResponseDto[]; meta: { partial: boolean; total: number } }> {
    const parsed = Number(limitRaw);
    const limit = Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 500) : 200;
    return this.toursService.getLeaderWorkspaceAggregate(limit);
  }

  @Get("leader-summary")
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Leader)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Tour"))
  @ApiOperation({
    summary: "Leader dashboard summary",
    description:
      "Single round-trip counts for the leader dashboard (tour total + registration pending/total).",
  })
  async getLeaderDashboardSummary(): Promise<{
    tour_total: number;
    tour_partial: boolean;
    registration_pending_count: number;
    registration_total_count: number;
  }> {
    const [workspace, registrationStats] = await Promise.all([
      this.toursService.getLeaderWorkspaceAggregate(200),
      this.registrationsService.getLeaderRegistrationStats(),
    ]);
    return {
      tour_total: workspace.meta.total,
      tour_partial: workspace.meta.partial,
      registration_pending_count: registrationStats.pending_count,
      registration_total_count: registrationStats.total_count,
    };
  }

  @Get("leader-registration-rows")
  @Roles(UserRole.Owner, UserRole.Admin, UserRole.Leader)
  @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Tour"))
  @ApiOperation({
    summary: "Leader registration index",
    description:
      "All tenant registrations with tour titles in one response (replaces per-tour registration fan-out).",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    schema: { default: 5000, minimum: 1, maximum: 10000 },
  })
  async getLeaderRegistrationRows(@Query("limit") limitRaw?: string): Promise<{
    rows: Awaited<ReturnType<RegistrationsService["listLeaderRegistrationIndex"]>>["rows"];
    partial: boolean;
  }> {
    const parsed = Number(limitRaw);
    const limit = Number.isInteger(parsed) && parsed > 0 ? parsed : 5_000;
    const result = await this.registrationsService.listLeaderRegistrationIndex(limit);
    return { rows: result.rows, partial: result.partial };
  }
}
