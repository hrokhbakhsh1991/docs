import { ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash } from "node:crypto";
import { QueryFailedError } from "typeorm";
import { DataSource, LessThan, Repository } from "typeorm";
import { IdempotencyKeyEntity } from "./entities/idempotency-key.entity";

const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const parsedTtlFromEnv = Number(process.env.IDEMPOTENCY_TTL_MS ?? "");
const IDEMPOTENCY_TTL_MS =
  Number.isFinite(parsedTtlFromEnv) && parsedTtlFromEnv > 0
    ? parsedTtlFromEnv
    : DEFAULT_IDEMPOTENCY_TTL_MS;

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKeyEntity)
    private readonly idempotencyRepository: Repository<IdempotencyKeyEntity>,
    private readonly dataSource: DataSource
  ) {}

  async findByKey(tenantId: string, key: string): Promise<IdempotencyKeyEntity | null> {
    return this.idempotencyRepository.findOne({ where: { tenantId, key } });
  }

  isExpired(record: Pick<IdempotencyKeyEntity, "expiresAt">): boolean {
    return record.expiresAt.getTime() <= Date.now();
  }

  async deleteExpired(): Promise<number> {
    const result = await this.idempotencyRepository.delete({
      expiresAt: LessThan(new Date())
    });
    return result.affected ?? 0;
  }

  async storeResponse(
    manager: DataSource["manager"],
    params: {
      tenantId: string;
      key: string;
      endpoint: string;
      requestHash: string;
      response: Record<string, unknown>;
      statusCode: number;
      ttlMs?: number;
    }
  ): Promise<IdempotencyKeyEntity> {
    const row = manager.create(IdempotencyKeyEntity, {
      tenantId: params.tenantId,
      key: params.key,
      endpoint: params.endpoint,
      requestHash: params.requestHash,
      responseBody: params.response,
      statusCode: params.statusCode,
      expiresAt: new Date(Date.now() + (params.ttlMs ?? IDEMPOTENCY_TTL_MS))
    });
    return manager.save(row);
  }

  createRequestHash(input: {
    method: string;
    path: string;
    body: unknown;
  }): string {
    const stable = JSON.stringify({
      method: input.method.toUpperCase(),
      path: input.path,
      body: input.body
    });
    return createHash("sha256").update(stable).digest("hex");
  }

  async executeWithIdempotency<TResponse>(
    params: {
      tenantId: string;
      key: string;
      endpoint: string;
      requestHash: string;
      statusCode?: number;
    },
    handler: (manager: DataSource["manager"]) => Promise<TResponse>
  ): Promise<{ statusCode: number; responseBody: TResponse; replayed: boolean }> {
    return this.dataSource.transaction(async (manager) => {
      const existing = await this.findRecord(manager, params.tenantId, params.key);

      const replayResult = this.resolveExistingRecord<TResponse>(existing, params);
      if (replayResult) return replayResult;

      if (existing && this.isExpired(existing)) {
        await manager.delete(IdempotencyKeyEntity, { id: existing.id });
      }

      const placeholder = manager.create(IdempotencyKeyEntity, {
        tenantId: params.tenantId,
        key: params.key,
        endpoint: params.endpoint,
        requestHash: params.requestHash,
        responseBody: null,
        statusCode: null,
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS)
      });
      const reservation = await this.reservePlaceholder(manager, placeholder, params);
      if ("replayResult" in reservation) {
        return reservation.replayResult as {
          statusCode: number;
          responseBody: TResponse;
          replayed: boolean;
        };
      }
      const reserved = reservation.reserved;
      const responseBody = await handler(manager);
      reserved.responseBody = responseBody as Record<string, unknown>;
      reserved.statusCode = params.statusCode ?? 201;
      await manager.save(reserved);
      return {
        statusCode: reserved.statusCode,
        responseBody,
        replayed: false
      };
    });
  }

  private async findRecord(
    manager: DataSource["manager"],
    tenantId: string,
    key: string
  ): Promise<IdempotencyKeyEntity | null> {
    return manager.findOne(IdempotencyKeyEntity, {
      where: { tenantId, key }
    });
  }

  private resolveExistingRecord<TResponse>(
    existing: IdempotencyKeyEntity | null,
    params: {
      endpoint: string;
      requestHash: string;
    }
  ): { statusCode: number; responseBody: TResponse; replayed: boolean } | null {
    if (!existing || this.isExpired(existing)) {
      return null;
    }
    if (existing.endpoint !== params.endpoint) {
      throw new ConflictException({
        error: {
          code: "IDEMPOTENCY_KEY_ENDPOINT_MISMATCH",
          message: "Idempotency key already used by a different endpoint"
        }
      });
    }
    if (existing.requestHash !== params.requestHash) {
      throw new ConflictException({
        error: {
          code: "IDEMPOTENCY_KEY_REPLAY_MISMATCH",
          message: "Idempotency key already used with a different payload"
        }
      });
    }
    if (existing.responseBody && existing.statusCode) {
      return {
        statusCode: existing.statusCode,
          responseBody: existing.responseBody as TResponse,
        replayed: true
      };
    }
    throw new ConflictException({
      error: {
        code: "IDEMPOTENCY_REQUEST_IN_PROGRESS",
        message: "Another request is in progress for this key"
      }
    });
  }

  private async reservePlaceholder(
    manager: DataSource["manager"],
    placeholder: IdempotencyKeyEntity,
    params: {
      tenantId: string;
      key: string;
      endpoint: string;
      requestHash: string;
    }
  ): Promise<
    | { reserved: IdempotencyKeyEntity }
    | {
        replayResult: {
          statusCode: number;
          responseBody: unknown;
          replayed: boolean;
        };
      }
  > {
    try {
      return { reserved: await manager.save(placeholder) };
    } catch (error: unknown) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }
      const existing = await this.findRecord(manager, params.tenantId, params.key);
      const replayResult = this.resolveExistingRecord(existing, params);
      if (replayResult) {
        return { replayResult };
      }
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      typeof (error as { driverError?: { code?: string } }).driverError?.code === "string" &&
      (error as { driverError?: { code?: string } }).driverError?.code === "23505"
    );
  }
}
