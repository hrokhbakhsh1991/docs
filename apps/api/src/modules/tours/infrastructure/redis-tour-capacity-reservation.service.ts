import { Inject, Injectable } from "@nestjs/common";
import type Redis from "ioredis";
import { CapacityExceededException } from "../../../common/errors/capacity-exceeded.exception";
import { REDIS_CLIENT } from "../../../infra/redis/redis.constants";
import type {
  TourCapacityReleaseInput,
  TourCapacityReservationPort,
  TourCapacitySnapshotInput,
} from "../domain/ports/tour-capacity-reservation.port";

const KEY_PREFIX = "tours:capacity:remaining:";

/** Atomically seed remaining slots (if missing) and decrement by 1. Returns new remaining count. */
const RESERVE_LUA = `
local key = KEYS[1]
local seed = tonumber(ARGV[1])
if seed == nil or seed < 0 then seed = 0 end
if redis.call('EXISTS', key) == 0 then
  redis.call('SET', key, seed)
end
return redis.call('DECR', key)
`;

/** Increment remaining but never exceed totalCapacity. */
const RELEASE_LUA = `
local key = KEYS[1]
local cap = tonumber(ARGV[1])
if cap == nil or cap < 0 then cap = 0 end
local current = tonumber(redis.call('GET', key) or '0')
if current >= cap then
  return current
end
return redis.call('INCR', key)
`;

function normalizeTenantId(tenantId: string): string {
  return tenantId.trim().toLowerCase();
}

function remainingFromSnapshot(totalCapacity: number, acceptedCount: number): number {
  const remaining = totalCapacity - acceptedCount;
  return remaining > 0 ? remaining : 0;
}

function redisKey(tenantId: string, tourId: string): string {
  return `${KEY_PREFIX}${normalizeTenantId(tenantId)}:${tourId.trim()}`;
}

@Injectable()
export class RedisTourCapacityReservationService implements TourCapacityReservationPort {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async reserveTicket(input: TourCapacitySnapshotInput): Promise<void> {
    const key = redisKey(input.tenantId, input.tourId);
    const seed = remainingFromSnapshot(input.totalCapacity, input.acceptedCount);
    const remaining = (await this.redis.eval(
      RESERVE_LUA,
      1,
      key,
      String(seed)
    )) as number;

    if (remaining < 0) {
      await this.redis.incr(key);
      throw new CapacityExceededException();
    }
  }

  async releaseTicket(input: TourCapacityReleaseInput): Promise<void> {
    const key = redisKey(input.tenantId, input.tourId);
    await this.redis.eval(RELEASE_LUA, 1, key, String(Math.max(0, input.totalCapacity)));
  }

  async syncRemainingFromSnapshot(input: TourCapacitySnapshotInput): Promise<void> {
    const key = redisKey(input.tenantId, input.tourId);
    const remaining = remainingFromSnapshot(input.totalCapacity, input.acceptedCount);
    await this.redis.set(key, String(remaining));
  }
}
