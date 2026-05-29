import { createHash } from "node:crypto";
import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, QueryFailedError } from "typeorm";
import { PaymentGatewayIdempotencyEntity } from "../entities/payment-gateway-idempotency.entity";
import type { IdempotencyKeyStore, IdempotentRunResult, PaymentIdempotencyScope } from "./payment-idempotency-key.store";
import { paymentGatewayIdempotencyCompositeKey } from "./payment-idempotency-key.store";

const PENDING_TTL_MS = 90_000;
const RESULT_TTL_MS = 86400_000 * 7;
const WAIT_DEADLINE_MS = 35_000;

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function digestOf(scope: PaymentIdempotencyScope): string {
  return createHash("sha256").update(paymentGatewayIdempotencyCompositeKey(scope)).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverCode = (error as { driverError?: { code?: string } }).driverError?.code;
  const topCode = (error as { code?: string }).code;
  return driverCode === "23505" || topCode === "23505";
}

type ClaimPhase =
  | { kind: "acquired" }
  | { kind: "replay"; payload: Record<string, unknown> }
  | { kind: "wait" }
  | { kind: "retry" };

/**
 * PostgreSQL-backed {@link IdempotencyKeyStore} for payment gateways.
 *
 * - **Cross-replica safe:** single canonical row per digest (PK); followers block on `SELECT … FOR UPDATE`
 *   until the leader commits `completed` or the pending row expires.
 * - **Crash-safe:** pending rows expire; followers delete stale `pending` and retry acquisition.
 *   Successful results persist until `expires_at` (TTL) for replay; failures delete the pending row so `fn` can retry.
 *
 * Complements PSP-native keys (e.g. Stripe `Idempotency-Key` on `paymentIntents.create`) by deduplicating
 * our process before hitting the network.
 */
@Injectable()
export class PostgresPaymentIdempotencyKeyStore implements IdempotencyKeyStore {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async runOnce<T>(scope: PaymentIdempotencyScope, fn: () => Promise<T>): Promise<IdempotentRunResult<T>> {
    const digest = digestOf(scope);
    const deadline = Date.now() + WAIT_DEADLINE_MS;
    let delayMs = 12;
    let acquired = false;

    while (Date.now() < deadline) {
      const phase = await this.dataSource.transaction(async (em) => {
        await em.query(`DELETE FROM payment_gateway_idempotency WHERE digest = $1 AND expires_at < NOW()`, [
          digest
        ]);

        try {
          const row = em.create(PaymentGatewayIdempotencyEntity, {
            digest,
            tenantId: scope.tenantId.trim(),
            operation: scope.operation.trim().slice(0, 191),
            idempotencyKey: scope.idempotencyKey.trim().slice(0, 255),
            status: "pending",
            resultPayload: null,
            expiresAt: new Date(Date.now() + PENDING_TTL_MS)
          });
          await em.save(row);
          return { kind: "acquired" } satisfies ClaimPhase;
        } catch (error: unknown) {
          if (!isUniqueViolation(error)) {
            throw error;
          }
        }

        const row = await em.findOne(PaymentGatewayIdempotencyEntity, {
          where: { digest },
          lock: { mode: "pessimistic_write" }
        });

        if (!row) {
          return { kind: "retry" } satisfies ClaimPhase;
        }

        if (row.status === "completed" && row.resultPayload != null) {
          return { kind: "replay", payload: row.resultPayload } satisfies ClaimPhase;
        }

        if (row.expiresAt.getTime() <= Date.now()) {
          await em.delete(PaymentGatewayIdempotencyEntity, { digest });
          return { kind: "retry" } satisfies ClaimPhase;
        }

        return { kind: "wait" } satisfies ClaimPhase;
      });

      if (phase.kind === "replay") {
        return { value: jsonClone(phase.payload) as T, replayed: true };
      }

      if (phase.kind === "acquired") {
        acquired = true;
        break;
      }

      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, 220);
    }

    if (!acquired) {
      throw new InternalServerErrorException({
        error: {
          code: "PAYMENT_IDEMPOTENCY_LOCK_TIMEOUT",
          message: "Timed out waiting for payment gateway idempotency row (Postgres)"
        }
      });
    }

    try {
      const value = await fn();
      const frozen = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
      const result = await this.dataSource.transaction(async (em) => {
        const res = await em
          // tenant-isolation:qb-exempt — idempotency digest is globally unique; no tenant column on row
          .createQueryBuilder()
          .update(PaymentGatewayIdempotencyEntity)
          .set({
            status: "completed",
            resultPayload: frozen,
            expiresAt: new Date(Date.now() + RESULT_TTL_MS)
          })
          .where("digest = :digest AND status = :status", { digest, status: "pending" })
          .execute();
        return res.affected ?? 0;
      });
      if (result === 0) {
        throw new InternalServerErrorException({
          error: {
            code: "PAYMENT_IDEMPOTENCY_ROW_LOST",
            message: "Payment gateway idempotency pending row was missing at commit time"
          }
        });
      }
      return { value: jsonClone(value) as T, replayed: false };
    } catch (error: unknown) {
      await this.dataSource.transaction(async (em) => {
        await em.delete(PaymentGatewayIdempotencyEntity, { digest });
      });
      throw error;
    }
  }
}
