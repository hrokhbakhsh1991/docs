import { ForbiddenException, Inject, Injectable, Optional } from "@nestjs/common";
import type { Redis } from "ioredis";
import { Like } from "typeorm";
import { OutboxEventEntity } from "../../../common/outbox/entities/outbox-event.entity";
import { tenantContextMissingError } from "../../../common/errors/error-response-builders";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { ConfigService } from "../../../config/config.service";
import { TenantDbContextService } from "../../../database/tenant-db-context.service";
import { REDIS_CLIENT } from "../../../infra/redis/redis.constants";
import { ledgerLinesFromFinanceOutboxRows } from "../reconciliation/payment-reconciliation-parse";
import { PaymentEntity, PaymentMethod, PaymentStatus } from "../../payments/entities/payment.entity";
import { PaymentReceiptEntity, ReceiptStatus } from "../../payments/entities/payment-receipt.entity";
import type { FinanceLedgerEventRow } from "./finance-ledger-event.dto";

export type FinanceReportsSummary = {
  pendingManualPayments: number;
  pendingReceiptReviews: number;
  paidPayments: number;
  failedPayments: number;
};

export type FinanceOpenPaymentRow = {
  id: string;
  registrationId: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: Date;
};

const SUMMARY_CACHE_TTL_SEC = 30;
const SUMMARY_CACHE_PREFIX = "finance:reports:summary:";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function mapOutboxRowToLedgerEvent(row: OutboxEventEntity, tenantId: string): FinanceLedgerEventRow | null {
  if (!row.eventType.startsWith("finance.ledger.")) {
    return null;
  }
  const payload = row.payload;
  const journalId =
    (typeof payload.journalId === "string" && payload.journalId.trim()) ||
    row.aggregateId ||
    "";
  const registrationId =
    typeof payload.registrationId === "string" && payload.registrationId.trim() !== ""
      ? payload.registrationId.trim()
      : null;
  const lines = ledgerLinesFromFinanceOutboxRows([row], tenantId);
  if (!journalId) {
    return null;
  }
  return {
    outboxEventId: row.id,
    eventType: row.eventType,
    journalId,
    registrationId,
    domainEventId: row.domainEventId,
    lineCount: lines.length,
    createdAt: row.createdAt,
    lines
  };
}

@Injectable()
export class FinanceReportsService {
  constructor(
    @Inject(TenantDbContextService) private readonly tenantDbContext: TenantDbContextService,
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null
  ) {}

  private resolveTenantIdOrThrow(): string {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId?.trim()) {
      throw new ForbiddenException(tenantContextMissingError());
    }
    return tenantId.trim();
  }

  private summaryCacheKey(tenantId: string): string {
    return `${SUMMARY_CACHE_PREFIX}${tenantId}`;
  }

  async invalidateSummaryCache(): Promise<void> {
    const tenantId = this.resolveTenantIdOrThrow();
    if (!this.redis || this.configService.getNodeEnv() === "test") {
      return;
    }
    try {
      await this.redis.del(this.summaryCacheKey(tenantId));
    } catch {
      /* non-fatal */
    }
  }

  async getSummary(): Promise<FinanceReportsSummary> {
    const tenantId = this.resolveTenantIdOrThrow();
    if (this.redis && this.configService.getNodeEnv() !== "test") {
      try {
        const cached = await this.redis.get(this.summaryCacheKey(tenantId));
        if (cached) {
          const parsed: unknown = JSON.parse(cached);
          if (isRecord(parsed)) {
            return {
              pendingManualPayments: Number(parsed.pendingManualPayments) || 0,
              pendingReceiptReviews: Number(parsed.pendingReceiptReviews) || 0,
              paidPayments: Number(parsed.paidPayments) || 0,
              failedPayments: Number(parsed.failedPayments) || 0
            };
          }
        }
      } catch {
        /* cache miss or parse failure — fall through to DB */
      }
    }

    const summary = await this.loadSummaryFromDb(tenantId);

    if (this.redis && this.configService.getNodeEnv() !== "test") {
      try {
        await this.redis.set(
          this.summaryCacheKey(tenantId),
          JSON.stringify(summary),
          "EX",
          SUMMARY_CACHE_TTL_SEC
        );
      } catch {
        /* non-fatal */
      }
    }

    return summary;
  }

  private async loadSummaryFromDb(tenantId: string): Promise<FinanceReportsSummary> {
    return this.tenantDbContext.runInTenantScope(tenantId, async (manager) => {
      const [pendingManualPayments, pendingReceiptReviews, paidPayments, failedPayments] =
        await Promise.all([
          manager.count(PaymentEntity, {
            where: {
              tenantId,
              method: PaymentMethod.MANUAL,
              status: PaymentStatus.PENDING
            }
          }),
          manager.count(PaymentReceiptEntity, {
            where: { tenantId, status: ReceiptStatus.PENDING }
          }),
          manager.count(PaymentEntity, {
            where: { tenantId, status: PaymentStatus.PAID }
          }),
          manager.count(PaymentEntity, {
            where: { tenantId, status: PaymentStatus.FAILED }
          })
        ]);

      return {
        pendingManualPayments,
        pendingReceiptReviews,
        paidPayments,
        failedPayments
      };
    });
  }

  async listLedgerEvents(limit = 50): Promise<FinanceLedgerEventRow[]> {
    const tenantId = this.resolveTenantIdOrThrow();
    const capped = Math.min(Math.max(limit, 1), 200);
    return this.tenantDbContext.runInTenantScope(tenantId, async (manager) => {
      const rows = await manager.find(OutboxEventEntity, {
        where: {
          tenantId,
          eventType: Like("finance.ledger.%")
        },
        order: { createdAt: "DESC" },
        take: capped,
        select: {
          id: true,
          eventType: true,
          payload: true,
          createdAt: true,
          domainEventId: true,
          aggregateId: true
        }
      });
      const events: FinanceLedgerEventRow[] = [];
      for (const row of rows) {
        const mapped = mapOutboxRowToLedgerEvent(row, tenantId);
        if (mapped) {
          events.push(mapped);
        }
      }
      return events;
    });
  }

  async listOpenPayments(limit = 100): Promise<FinanceOpenPaymentRow[]> {
    const tenantId = this.resolveTenantIdOrThrow();
    return this.tenantDbContext.runInTenantScope(tenantId, async (manager) => {
      const rows = await manager.find(PaymentEntity, {
        where: { tenantId, status: PaymentStatus.PENDING },
        order: { createdAt: "ASC" },
        take: limit,
        select: {
          id: true,
          registrationId: true,
          amount: true,
          currency: true,
          method: true,
          status: true,
          createdAt: true
        }
      });
      return rows.map((row) => ({
        id: row.id,
        registrationId: row.registrationId,
        amount: row.amount,
        currency: row.currency,
        method: row.method,
        status: row.status,
        createdAt: row.createdAt
      }));
    });
  }
}
