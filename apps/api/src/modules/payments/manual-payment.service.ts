import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TenantDbContextService } from "../../database/tenant-db-context.service";
import { PaymentEntity, PaymentMethod, PaymentStatus } from "./entities/payment.entity";
import { RegistrationEntity } from "../registrations/registration.entity";
import { FinanceReportsService } from "../finance/reports/finance-reports.service";
import { assertManualPaymentDebtAllowed } from "./domain/manual-payment-debt.policy";

@Injectable()
export class ManualPaymentService {
  constructor(
    @Inject(TenantDbContextService) private readonly tenantDbContext: TenantDbContextService,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    @Inject(FinanceReportsService) private readonly financeReportsService: FinanceReportsService
  ) {}

  async createManualPayment(params: {
    tenantId: string;
    registrationId: string;
    amount: string;
    currency: string;
  }): Promise<PaymentEntity> {
    return this.tenantDbContext.runInTenantScope(params.tenantId, async (manager) => {
      const registration = await manager.findOne(RegistrationEntity, {
        where: { id: params.registrationId, tenantId: params.tenantId }
      });

      if (!registration) {
        throw new NotFoundException("Registration not found");
      }

      const existingPayments = await manager.find(PaymentEntity, {
        where: {
          registrationId: registration.id,
          tenantId: params.tenantId
        },
        select: { status: true }
      });
      assertManualPaymentDebtAllowed(existingPayments.map((p) => p.status));

      const payment = manager.create(PaymentEntity, {
        tenantId: params.tenantId,
        registrationId: registration.id,
        amount: params.amount,
        currency: params.currency,
        method: PaymentMethod.MANUAL,
        status: PaymentStatus.PENDING,
        provider: "manual"
      });

      const saved = await manager.save(PaymentEntity, payment);
      await this.financeReportsService.invalidateSummaryCache(params.tenantId);
      return saved;
    });
  }

  async listManualPayments(tenantId: string): Promise<PaymentEntity[]> {
    return this.paymentRepository.find({
      where: { tenantId, method: PaymentMethod.MANUAL },
      order: { createdAt: "DESC" },
      take: 100
    });
  }
}
