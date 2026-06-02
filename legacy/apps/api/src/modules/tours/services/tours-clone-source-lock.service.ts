import { randomUUID } from "node:crypto";

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import type Redis from "ioredis";

import { tenantScopedResourceNotFoundError } from "../../../common/errors/error-response-builders";
import { REDIS_CLIENT } from "../../../infra/redis/redis.constants";
import {
  TOURS_WRITE_REPOSITORY_PORT,
  type ToursWriteRepositoryPort,
} from "../domain/ports/tours-repository.port";

const REDIS_KEY_PREFIX = "tours:clone:source:";
/** Upper bound for clone work (orchestration + media copy + persist). */
const REDIS_LOCK_TTL_MS = 15 * 60 * 1000;

const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

function redisLockKey(tenantId: string, sourceTourId: string): string {
  return `${REDIS_KEY_PREFIX}${tenantId.trim().toLowerCase()}:${sourceTourId.trim()}`;
}

export class TourCloneSourceLockedException extends ConflictException {
  constructor() {
    super({
      error: {
        code: "TOUR_CLONE_SOURCE_LOCKED",
        message:
          "Another clone is in progress for this source tour. Retry after it completes or use a new Idempotency-Key for a distinct clone.",
      },
    });
  }
}

/**
 * Serializes clone work per `(workspace, sourceTourId)`.
 * Prefers Redis `SET NX`; falls back to `SELECT … FOR UPDATE` on the source tour row.
 */
@Injectable()
export class ToursCloneSourceLockService {
  constructor(
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    @Inject(TOURS_WRITE_REPOSITORY_PORT)
    private readonly toursWriteRepository: ToursWriteRepositoryPort,
  ) {}

  async withSourceCloneLock<T>(
    sourceTourId: string,
    tenantId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const trimmedSourceId = sourceTourId.trim();
    const trimmedTenantId = tenantId.trim();
    if (this.redis) {
      return this.withRedisLock(trimmedSourceId, trimmedTenantId, fn);
    }
    return this.withPostgresSourceRowLock(trimmedSourceId, trimmedTenantId, fn);
  }

  private async withRedisLock<T>(
    sourceTourId: string,
    tenantId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const key = redisLockKey(tenantId, sourceTourId);
    const token = randomUUID();
    const acquired = await this.redis!.set(key, token, "PX", REDIS_LOCK_TTL_MS, "NX");
    if (acquired !== "OK") {
      throw new TourCloneSourceLockedException();
    }
    try {
      return await fn();
    } finally {
      await this.redis!.eval(RELEASE_LOCK_LUA, 1, key, token);
    }
  }

  private async withPostgresSourceRowLock<T>(
    sourceTourId: string,
    tenantId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.toursWriteRepository.runInTransaction(async () => {
      const locked = await this.toursWriteRepository.loadTourForUpdateLocking(
        sourceTourId,
        tenantId,
      );
      if (!locked) {
        throw new NotFoundException(tenantScopedResourceNotFoundError());
      }
      return fn();
    });
  }
}
