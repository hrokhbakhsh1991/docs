import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthorizationPresenceGuard } from "../../auth/authorization-presence.guard";
import { RolesGuard } from "../../auth/roles.guard";
import { AbilitiesGuard } from "../../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../../common/casl/casl-mirror-abilities.guard";
import { RequireCapability } from "../../../common/casl/require-capability.decorator";
import { Roles } from "../../auth/roles.decorator";
import { UserRole } from "../../../common/auth/user-role.enum";
import { FinanceReportsService } from "./finance-reports.service";

@ApiTags("Finance Reports")
@Controller("api/v2/finance/reports")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@RequireCapability("module.finance")
@ApiBearerAuth()
export class FinanceReportsController {
  constructor(
    @Inject(FinanceReportsService) private readonly financeReportsService: FinanceReportsService
  ) {}

  @Get("summary")
  @Roles(UserRole.Leader, UserRole.Admin, UserRole.Owner)
  @ApiOperation({ summary: "Finance workspace summary counts" })
  async getSummary() {
    return this.financeReportsService.getSummary();
  }

  @Get("open-payments")
  @Roles(UserRole.Admin, UserRole.Owner)
  @ApiOperation({ summary: "List pending payments awaiting settlement" })
  async listOpenPayments() {
    return this.financeReportsService.listOpenPayments();
  }

  @Get("ledger-events")
  @Roles(UserRole.Leader, UserRole.Admin, UserRole.Owner)
  @ApiOperation({
    summary: "Recent finance ledger journals (from transactional outbox)"
  })
  async listLedgerEvents() {
    return this.financeReportsService.listLedgerEvents();
  }
}
