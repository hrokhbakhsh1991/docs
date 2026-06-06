import Redis from "ioredis";

const RATE_LIMIT_KEY_PREFIX = "ratelimit";

/**
 * Deletes Redis keys used by rate-limiter-flexible (`keyPrefix: ratelimit`).
 * Dev/test ops helper for bad-deploy rollback drills (DEC-106).
 */
export async function flushRedisRateLimitKeys(redisUrl: string): Promise<number> {
  const client = new Redis(redisUrl, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
    lazyConnect: true,
  });

  try {
    await client.connect();
    let cursor = "0";
    let deleted = 0;

    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        `${RATE_LIMIT_KEY_PREFIX}*`,
        "COUNT",
        100
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        deleted += await client.del(...keys);
      }
    } while (cursor !== "0");

    return deleted;
  } finally {
    client.disconnect();
  }
}
