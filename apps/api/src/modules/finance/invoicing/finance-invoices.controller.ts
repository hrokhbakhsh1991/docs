import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthorizationPresenceGuard } from "../../auth/authorization-presence.guard";
import { RolesGuard } from "../../auth/roles.guard";
import { AbilitiesGuard } from "../../../common/casl/abilities.guard";
import { CaslMirrorAbilitiesGuard } from "../../../common/casl/casl-mirror-abilities.guard";
import { RequireCapability } from "../../../common/casl/require-capability.decorator";
import { Roles } from "../../auth/roles.decorator";
import { UserRole } from "../../../common/auth/user-role.enum";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { tenantContextMissingError } from "../../../common/errors/error-response-builders";
import {
  INVOICE_READ_MODEL_PORT,
  type InvoiceReadModelPort,
} from "../domain/ports/invoice-read-model.port";
import { bookingWalletIdForRegistration } from "./parse-booking-wallet-id";

@ApiTags("Finance Invoices")
@Controller("api/v2/finance/invoices")
@UseGuards(AuthorizationPresenceGuard, RolesGuard, AbilitiesGuard, CaslMirrorAbilitiesGuard)
@RequireCapability("module.finance")
@ApiBearerAuth()
export class FinanceInvoicesController {
  constructor(
    @Inject(INVOICE_READ_MODEL_PORT)
    private readonly invoiceReadModel: InvoiceReadModelPort,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService
  ) {}

  @Get("bookings/:bookingId/derived")
  @Roles(UserRole.Leader, UserRole.Admin, UserRole.Owner)
  @ApiOperation({
    summary: "Compile a runtime immutable invoice view for a booking wallet",
  })
  async getDerivedInvoice(@Param("bookingId") bookingId: string) {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }

    const bookingWalletId = bookingWalletIdForRegistration(bookingId);

    try {
      const view = await this.invoiceReadModel.getDerivedInvoice(bookingWalletId, tenantId);
      if (view.tenantId.trim().toLowerCase() !== tenantId.trim().toLowerCase()) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope",
          },
        });
      }
      return {
        tenantId: view.tenantId,
        bookingWalletId: view.bookingWalletId,
        bookingId: view.bookingId,
        snapshotId: view.snapshotId,
        currency: view.currency,
        invoiceTotalMinor: view.invoiceTotalMinor,
        paidAmountMinor: view.paidAmountMinor,
        balanceDueMinor: view.balanceDueMinor,
        issuedAtIso: view.issuedAtIso,
        invoice: view.invoice,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error instanceof Error && error.message.startsWith("INVALID_BOOKING_WALLET_ID")) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Resource not found in tenant scope",
          },
        });
      }
      throw error;
    }
  }
}
