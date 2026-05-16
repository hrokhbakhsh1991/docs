import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { Brackets } from "typeorm";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { TenantAuditEventsService } from "../../common/audit/tenant-audit-events.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { TenantDbContextService } from "../../database/tenant-db-context.service";
import { ReconciliationFindingEntity } from "../finance/reconciliation/entities/reconciliation-finding.entity";
import type { PaymentReconciliationFinding } from "../finance/reconciliation/payment-reconciliation-report";
import { PaymentReconciliationFindingKind } from "../finance/reconciliation/payment-reconciliation-report";
import { emitReconciliationOperatorLedgerAdjustment } from "../finance/ledger/reconciliation-operator-ledger-adjustment";
import type { ReconciliationOperatorLedgerFlow } from "../finance/ledger/reconciliation-operator-ledger-adjustment";
import { OutboxService } from "../outbox/outbox.service";
import { ReconciliationFindingStatus } from "../finance/reconciliation/reconciliation-finding-status";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type ReconciliationFindingListCursor = { createdAt: Date; id: string };

export function encodeReconciliationFindingListCursor(c: ReconciliationFindingListCursor): string {
  return Buffer.from(JSON.stringify({ at: c.createdAt.toISOString(), id: c.id }), "utf8").toString(
    "base64url"
  );
}

export function decodeReconciliationFindingListCursor(raw: string): ReconciliationFindingListCursor | null {
  try {
    const decoded = Buffer.from(raw.trim(), "base64url").toString("utf8");
    const j = JSON.parse(decoded) as { at?: string; id?: string };
    if (typeof j.at !== "string" || typeof j.id !== "string") return null;
    const createdAt = new Date(j.at);
    if (Number.isNaN(createdAt.getTime())) return null;
    const id = j.id.trim();
    if (!id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export type ReconciliationFindingRowDto = {
  id: string;
  tenantId: string;
  reconciliationJobId: string;
  findingUuid: string;
  bookingId: string;
  kind: string;
  severity: string;
  message: string;
  data: Record<string, unknown>;
  triadMismatch: Record<string, unknown> | null;
  status: ReconciliationFindingStatus;
  resolutionNote: string | null;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class ReconciliationFindingsService {
  constructor(
    private readonly tenantDbContext: TenantDbContextService,
    private readonly outboxService: OutboxService,
    private readonly tenantAudit: TenantAuditEventsService,
    private readonly requestContext: RequestContextService
  ) {}

  async persistForJob(
    manager: EntityManager,
    tenantId: string,
    jobId: string,
    findings: readonly PaymentReconciliationFinding[]
  ): Promise<void> {
    if (findings.length === 0) {
      return;
    }
    const envelope = tenantId.trim().toLowerCase();
    const rows = findings.map((f) => ({
      tenantId: envelope,
      reconciliationJobId: jobId,
      findingUuid: f.id,
      bookingId: f.bookingId,
      kind: f.kind,
      severity: f.severity,
      message: f.message,
      data: f.data as Record<string, unknown>,
      triadMismatch: f.triadMismatch ? ({ ...f.triadMismatch } as Record<string, unknown>) : null,
      status: ReconciliationFindingStatus.OPEN
    }));
    await manager.insert(ReconciliationFindingEntity, rows as QueryDeepPartialEntity<ReconciliationFindingEntity>[]);
  }

  async listForTenant(input: {
    tenantId: string;
    status?: ReconciliationFindingStatus;
    limit?: number;
    cursor?: string | null;
  }): Promise<{ data: ReconciliationFindingRowDto[]; nextCursor: string | null }> {
    const tenant = input.tenantId.trim().toLowerCase();
    const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const cur = input.cursor?.trim() ? decodeReconciliationFindingListCursor(input.cursor.trim()) : null;

    return this.tenantDbContext.runInTenantScope(tenant, async (manager) => {
      const r = manager.getRepository(ReconciliationFindingEntity);
      const qb = r
        .createQueryBuilder("f")
        .where("f.tenant_id = :tenant", { tenant })
        .orderBy("f.created_at", "DESC")
        .addOrderBy("f.id", "DESC")
        .take(limit + 1);

      if (input.status !== undefined) {
        qb.andWhere("f.status = :st", { st: input.status });
      }

      if (cur) {
        qb.andWhere(
          new Brackets((w) => {
            w.where("f.created_at < :cAt", { cAt: cur.createdAt }).orWhere(
              new Brackets((w2) => {
                w2.where("f.created_at = :cAt2", { cAt2: cur.createdAt }).andWhere("f.id < :cId", { cId: cur.id });
              })
            );
          })
        );
      }

      const rows = await qb.getMany();
      const page = rows.slice(0, limit);
      const hasMore = rows.length > limit;
      const tail = page[page.length - 1];
      const nextCursor =
        hasMore && tail
          ? encodeReconciliationFindingListCursor({ createdAt: tail.createdAt, id: tail.id })
          : null;

      return {
        data: page.map((row) => this.toDto(row)),
        nextCursor
      };
    });
  }

  async acknowledgeFinding(input: {
    tenantId: string;
    findingId: string;
    actorUserId: string;
    actorLabel: string;
    note?: string;
  }): Promise<ReconciliationFindingRowDto> {
    return this.tenantDbContext.runInTenantScope(input.tenantId.trim().toLowerCase(), async (manager) => {
      const row = await manager.findOne(ReconciliationFindingEntity, {
        where: { id: input.findingId, tenantId: input.tenantId.trim().toLowerCase() }
      });
      if (!row) {
        throw new NotFoundException({
          error: { code: "RESOURCE_NOT_FOUND", message: "Reconciliation finding not found" }
        });
      }
      if (row.status !== ReconciliationFindingStatus.OPEN) {
        throw new ConflictException({
          error: { code: "STATE_TRANSITION_INVALID", message: "Only open findings can be acknowledged" }
        });
      }
      row.status = ReconciliationFindingStatus.ACKNOWLEDGED;
      row.resolutionNote = input.note?.trim() || null;
      await manager.save(ReconciliationFindingEntity, row);

      await this.tenantAudit.append(
        {
          tenantId: row.tenantId,
          actorUserId: input.actorUserId,
          actor: input.actorLabel,
          action: "reconciliation.finding.acknowledged",
          resourceType: "ReconciliationFinding",
          resourceId: row.id,
          metadata: {
            finding_uuid: row.findingUuid,
            reconciliation_job_id: row.reconciliationJobId,
            booking_id: row.bookingId,
            note: row.resolutionNote
          },
          clientIp: this.requestContext.tryGetClientIp() ?? "unknown",
          requestId: this.requestContext.tryGetRequestId()
        },
        manager
      );

      return this.toDto(row);
    });
  }

  async applyLedgerAdjustment(input: {
    tenantId: string;
    findingId: string;
    actorUserId: string;
    actorLabel: string;
    idempotencyKey: string;
    amountMinor: string;
    flow: ReconciliationOperatorLedgerFlow;
    currencyOverride?: string;
    note?: string;
  }): Promise<ReconciliationFindingRowDto> {
    const trimmedKey = input.idempotencyKey.trim();
    if (trimmedKey.length < 8) {
      throw new BadRequestException({
        error: { code: "VALIDATION_FAILED", message: "idempotencyKey must be at least 8 characters" }
      });
    }
    if (!/^\d+$/.test(input.amountMinor.trim())) {
      throw new BadRequestException({
        error: { code: "VALIDATION_FAILED", message: "amountMinor must be a positive integer minor string" }
      });
    }
    if (input.amountMinor.trim() === "0") {
      throw new BadRequestException({
        error: { code: "VALIDATION_FAILED", message: "amountMinor must be > 0" }
      });
    }

    return this.tenantDbContext.runInTenantScope(input.tenantId.trim().toLowerCase(), async (manager) => {
      const row = await manager.findOne(ReconciliationFindingEntity, {
        where: { id: input.findingId, tenantId: input.tenantId.trim().toLowerCase() }
      });
      if (!row) {
        throw new NotFoundException({
          error: { code: "RESOURCE_NOT_FOUND", message: "Reconciliation finding not found" }
        });
      }
      if (
        row.status !== ReconciliationFindingStatus.OPEN &&
        row.status !== ReconciliationFindingStatus.ACKNOWLEDGED
      ) {
        throw new ConflictException({
          error: { code: "STATE_TRANSITION_INVALID", message: "Finding is not eligible for ledger adjustment" }
        });
      }
      if (row.kind !== PaymentReconciliationFindingKind.AMOUNT_TRIAD_MISMATCH || !row.triadMismatch) {
        throw new BadRequestException({
          error: {
            code: "RECONCILIATION_ADJUSTMENT_NOT_SUPPORTED",
            message: "Ledger adjustments are limited to amount triad mismatches in this release"
          }
        });
      }

      const tri = row.triadMismatch as { currency?: string };
      const currency = (input.currencyOverride?.trim() || tri.currency || "").trim().toUpperCase();
      if (currency.length !== 3) {
        throw new BadRequestException({
          error: { code: "VALIDATION_FAILED", message: "Could not resolve a 3-letter currency for this finding" }
        });
      }

      const { journalId } = await emitReconciliationOperatorLedgerAdjustment({
        manager,
        outboxService: this.outboxService,
        tenantId: row.tenantId,
        registrationId: row.bookingId,
        currency,
        amountMinor: input.amountMinor.trim(),
        flow: input.flow,
        idempotencyKey: trimmedKey,
        findingId: row.id,
        operatorNote: input.note?.trim() || "reconciliation_operator_ledger_adjustment"
      });

      row.status = ReconciliationFindingStatus.RESOLVED;
      row.resolutionNote = input.note?.trim() || null;
      row.resolvedByUserId = input.actorUserId;
      row.resolvedAt = new Date();
      await manager.save(ReconciliationFindingEntity, row);

      await this.tenantAudit.append(
        {
          tenantId: row.tenantId,
          actorUserId: input.actorUserId,
          actor: input.actorLabel,
          action: "reconciliation.ledger.adjustment_applied",
          resourceType: "ReconciliationFinding",
          resourceId: row.id,
          metadata: {
            finding_uuid: row.findingUuid,
            reconciliation_job_id: row.reconciliationJobId,
            booking_id: row.bookingId,
            journal_id: journalId,
            flow: input.flow,
            amount_minor: input.amountMinor.trim(),
            currency,
            idempotency_key: trimmedKey
          },
          clientIp: this.requestContext.tryGetClientIp() ?? "unknown",
          requestId: this.requestContext.tryGetRequestId()
        },
        manager
      );

      return this.toDto(row);
    });
  }

  private toDto(r: ReconciliationFindingEntity): ReconciliationFindingRowDto {
    return {
      id: r.id,
      tenantId: r.tenantId,
      reconciliationJobId: r.reconciliationJobId,
      findingUuid: r.findingUuid,
      bookingId: r.bookingId,
      kind: r.kind,
      severity: r.severity,
      message: r.message,
      data: r.data ?? {},
      triadMismatch: r.triadMismatch ?? null,
      status: r.status,
      resolutionNote: r.resolutionNote ?? null,
      resolvedByUserId: r.resolvedByUserId ?? null,
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    };
  }
}
