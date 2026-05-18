import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthorizationPresenceGuard } from "../../auth/authorization-presence.guard";
import { RolesGuard } from "../../auth/roles.guard";
import { AbilitiesGuard } from "../../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../../common/casl/casl-mirror-abilities.guard";
import { RequireCapability } from "../../../common/casl/require-capability.decorator";
import { Roles } from "../../auth/roles.decorator";
import { UserRole } from "../../../common/auth/user-role.enum";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { FinanceReportsService } from "./finance-reports.service";

@ApiTags("Finance Reports")
@Controller("api/v2/finance/reports")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@RequireCapability("module.finance")
@ApiBearerAuth()
export class FinanceReportsController {
  constructor(
    @Inject(FinanceReportsService) private readonly financeReportsService: FinanceReportsService,
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService
  ) {}

  @Get("summary")
  @Roles(UserRole.Leader, UserRole.Admin, UserRole.Owner)
  @ApiOperation({ summary: "Finance workspace summary counts" })
  async getSummary() {
    const tenantId = this.requestContextService.resolveEffectiveTenantId()!;
    return this.financeReportsService.getSummary(tenantId);
  }

  @Get("open-payments")
  @Roles(UserRole.Admin, UserRole.Owner)
  @ApiOperation({ summary: "List pending payments awaiting settlement" })
  async listOpenPayments() {
    const tenantId = this.requestContextService.resolveEffectiveTenantId()!;
    return this.financeReportsService.listOpenPayments(tenantId);
  }

  @Get("ledger-events")
  @Roles(UserRole.Leader, UserRole.Admin, UserRole.Owner)
  @ApiOperation({
    summary: "Recent finance ledger journals (from transactional outbox)"
  })
  async listLedgerEvents() {
    const tenantId = this.requestContextService.resolveEffectiveTenantId()!;
    return this.financeReportsService.listLedgerEvents(tenantId);
  }
}
