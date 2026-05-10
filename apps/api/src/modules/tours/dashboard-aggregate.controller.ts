import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AuthorizationPresenceGuard } from "../auth/authorization-presence.guard";
import { Roles } from "../auth/roles.decorator";
import { Role } from "../auth/roles.enum";
import { RolesGuard } from "../auth/roles.guard";
import { ToursService } from "./tours.service";
import type { TourResponseDto } from "./dto/tour-response.dto";

@ApiTags("Dashboard")
@Controller("api/v2/dashboard")
@UseGuards(AuthorizationPresenceGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardAggregateController {
  constructor(private readonly toursService: ToursService) {}

  @Get("leader-workspace")
  @Roles(Role.OWNER, Role.ADMIN)
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
}
