import { ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash } from "node:crypto";
import { DataSource, LessThan, Repository } from "typeorm";
import { IdempotencyKeyEntity } from "./entities/idempotency-key.entity";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKeyEntity)
    private readonly idempotencyRepository: Repository<IdempotencyKeyEntity>,
    private readonly dataSource: DataSource
  ) {}

  async findByKey(key: string): Promise<IdempotencyKeyEntity | null> {
    return this.idempotencyRepository.findOne({ where: { key } });
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
      key: string;
      endpoint: string;
      requestHash: string;
      response: Record<string, unknown>;
      statusCode: number;
      ttlMs?: number;
    }
  ): Promise<IdempotencyKeyEntity> {
    const row = manager.create(IdempotencyKeyEntity, {
      key: params.key,
      endpoint: params.endpoint,
      requestHash: params.requestHash,
      responseBody: params.response,
      statusCode: params.statusCode,
      expiresAt: new Date(Date.now() + (params.ttlMs ?? IDEMPOTENCY_TTL_MS))
    });
    return manager.save(row);
  }

  createRequestHash(input: { tourId: string; body: unknown }): string {
    const stable = JSON.stringify({ tourId: input.tourId, body: input.body });
    return createHash("sha256").update(stable).digest("hex");
  }

  async executeWithIdempotency(
    params: {
      key: string;
      endpoint: string;
      requestHash: string;
      statusCode?: number;
    },
    handler: (manager: DataSource["manager"]) => Promise<Record<string, unknown>>
  ): Promise<{ statusCode: number; responseBody: Record<string, unknown>; replayed: boolean }> {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(IdempotencyKeyEntity, {
        where: { key: params.key }
      });

      if (existing && !this.isExpired(existing)) {
        if (existing.requestHash !== params.requestHash) {
          throw new ConflictException({
            error: {
              code: "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH",
              message: "Idempotency key already used with a different payload"
            }
          });
        }
        if (existing.responseBody && existing.statusCode) {
          return {
            statusCode: existing.statusCode,
            responseBody: existing.responseBody,
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

      if (existing && this.isExpired(existing)) {
        await manager.delete(IdempotencyKeyEntity, { id: existing.id });
      }

      const placeholder = manager.create(IdempotencyKeyEntity, {
        key: params.key,
        endpoint: params.endpoint,
        requestHash: params.requestHash,
        responseBody: null,
        statusCode: null,
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS)
      });
      const reserved = await manager.save(placeholder);
      const responseBody = await handler(manager);
      reserved.responseBody = responseBody;
      reserved.statusCode = params.statusCode ?? 201;
      await manager.save(reserved);
      return {
        statusCode: reserved.statusCode,
        responseBody,
        replayed: false
      };
    });
  }
}
