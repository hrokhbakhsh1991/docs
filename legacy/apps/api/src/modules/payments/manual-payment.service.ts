import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { tenantContextMissingError } from "../../common/errors/error-response-builders";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { TenantDbContextService } from "../../database/tenant-db-context.service";
import { PaymentMethod, PaymentStatus } from "./domain/payment.types";
import type { PaymentRecord } from "./domain/payment-record.types";
import { FinanceReportsService } from "../finance/reports/finance-reports.service";
import { assertManualPaymentDebtAllowed } from "./domain/manual-payment-debt.policy";
import { enforcePaymentIntentFinanceContract } from "./enforce-payment-intent-finance-contract";
import {
  PAYMENT_REPOSITORY_PORT,
  type PaymentRepositoryPort
} from "./domain/ports/payment-repository.port";

@Injectable()
export class ManualPaymentService {
  constructor(
    @Inject(TenantDbContextService) private readonly tenantDbContext: TenantDbContextService,
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService,
    @Inject(PAYMENT_REPOSITORY_PORT)
    private readonly paymentRepository: PaymentRepositoryPort,
    @Inject(FinanceReportsService) private readonly financeReportsService: FinanceReportsService
  ) {}

  private resolveTenantIdOrThrow(): string {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId?.trim()) {
      throw new ForbiddenException(tenantContextMissingError());
    }
    return tenantId.trim();
  }

  async createManualPayment(params: {
    registrationId: string;
    amount: string;
    currency: string;
  }): Promise<PaymentRecord> {
    const tenantId = this.resolveTenantIdOrThrow();
    return this.tenantDbContext.runInTenantScope(tenantId, async (manager) => {
      const registration = await this.paymentRepository.findRegistrationByTenantAndId(
        manager,
        params.registrationId,
        tenantId
      );

      if (!registration) {
        throw new NotFoundException("Registration not found");
      }

      const existingPayments = await this.paymentRepository.findStatusesByRegistration(
        manager,
        registration.id,
        tenantId
      );
      assertManualPaymentDebtAllowed(existingPayments.map((p) => p.status));

      enforcePaymentIntentFinanceContract(
        {
          tenantId,
          registrationId: registration.id,
          amount: params.amount,
          currency: params.currency,
          method: PaymentMethod.MANUAL,
          provider: "manual",
          providerPaymentId: null,
          status: PaymentStatus.PENDING,
          paidAt: null,
          failedAt: null,
          refundedAt: null,
          ledgerJournalId: null,
        },
        "createManualPayment",
      );

      const payment = this.paymentRepository.createPayment(manager, {
        tenantId,
        registrationId: registration.id,
        amount: params.amount,
        currency: params.currency,
        method: PaymentMethod.MANUAL,
        status: PaymentStatus.PENDING,
        provider: "manual"
      });

      const saved = await this.paymentRepository.savePayment(manager, payment);
      await this.financeReportsService.invalidateSummaryCache();
      return saved;
    });
  }

  async listManualPayments(): Promise<PaymentRecord[]> {
    const tenantId = this.resolveTenantIdOrThrow();
    return this.paymentRepository.listManualByTenant(tenantId);
  }
}
