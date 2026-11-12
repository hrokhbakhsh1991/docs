import Redis from "ioredis";

const KEY_PREFIX = "platform-impersonation:v1";
let redisClient: Redis | null = null;

export type PlatformImpersonationRedisCommands = {
  get(key: string): Promise<string | null>;
  setWithTtl(key: string, value: string, ttlSeconds: number): Promise<string | null>;
  setIfAbsentWithTtl(key: string, value: string, ttlSeconds: number): Promise<string | null>;
};
let testRedisClient: PlatformImpersonationRedisCommands | null = null;

function redisCommands(client: Redis): PlatformImpersonationRedisCommands {
  return {
    get: (key) => client.get(key),
    setWithTtl: (key, value, ttlSeconds) => client.set(key, value, "EX", ttlSeconds),
    setIfAbsentWithTtl: (key, value, ttlSeconds) => client.set(key, value, "EX", ttlSeconds, "NX"),
  };
}

export class PlatformImpersonationStateUnavailableError extends Error {
  readonly statusCode = 503;
  readonly code = "PLATFORM_IMPERSONATION_STATE_UNAVAILABLE";

  constructor() {
    super("PLATFORM_IMPERSONATION_STATE_UNAVAILABLE");
    this.name = "PlatformImpersonationStateUnavailableError";
  }
}

export class PlatformImpersonationTokenConsumedError extends Error {
  readonly statusCode = 401;
  readonly code = "PLATFORM_IMPERSONATION_TOKEN_CONSUMED";

  constructor() {
    super("PLATFORM_IMPERSONATION_TOKEN_CONSUMED");
    this.name = "PlatformImpersonationTokenConsumedError";
  }
}

function getRedis(): PlatformImpersonationRedisCommands {
  if (testRedisClient !== null) {
    return testRedisClient;
  }
  if (redisClient !== null) {
    return redisCommands(redisClient);
  }

  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    throw new PlatformImpersonationStateUnavailableError();
  }

  redisClient = new Redis(redisUrl, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 500,
    lazyConnect: true,
    retryStrategy: () => null,
  });
  redisClient.on("error", () => {
    // State checks fail closed at the call site; never log session identifiers.
  });
  return redisCommands(redisClient);
}

function validTtlSeconds(expiresAt: number): number {
  const ttl = Math.floor(expiresAt - Date.now() / 1000);
  if (!Number.isFinite(ttl) || ttl < 1) {
    throw new PlatformImpersonationTokenConsumedError();
  }
  return ttl;
}

function key(jti: string, state: "exchanged" | "revoked"): string {
  return `${KEY_PREFIX}:${state}:${jti}`;
}

async function withRedisState<T>(
  operation: (client: PlatformImpersonationRedisCommands) => Promise<T>
): Promise<T> {
  try {
    return await operation(getRedis());
  } catch (error) {
    if (
      error instanceof PlatformImpersonationStateUnavailableError ||
      error instanceof PlatformImpersonationTokenConsumedError
    ) {
      throw error;
    }
    throw new PlatformImpersonationStateUnavailableError();
  }
}

export async function consumePlatformImpersonationExchange(
  jti: string,
  expiresAt: number
): Promise<void> {
  if (!jti) {
    throw new PlatformImpersonationTokenConsumedError();
  }
  const result = await withRedisState((client) =>
    client.setIfAbsentWithTtl(key(jti, "exchanged"), "1", validTtlSeconds(expiresAt))
  );
  if (result !== "OK") {
    throw new PlatformImpersonationTokenConsumedError();
  }
}

export async function revokePlatformImpersonationSession(
  jti: string,
  expiresAt: number
): Promise<void> {
  if (!jti) {
    throw new PlatformImpersonationTokenConsumedError();
  }
  await withRedisState((client) =>
    client.setWithTtl(key(jti, "revoked"), "1", validTtlSeconds(expiresAt))
  );
}

export async function assertPlatformImpersonationSessionActive(jti: string): Promise<void> {
  if (!jti) {
    throw new PlatformImpersonationTokenConsumedError();
  }
  const state = await withRedisState(async (client) => ({
    exchanged: await client.get(key(jti, "exchanged")),
    revoked: await client.get(key(jti, "revoked")),
  }));
  if (state.exchanged === null || state.revoked !== null) {
    throw new PlatformImpersonationTokenConsumedError();
  }
}

export function setPlatformImpersonationRedisClientForTests(
  client: PlatformImpersonationRedisCommands | null
): void {
  testRedisClient = client;
}

export function resetPlatformImpersonationSessionStateForTests(): void {
  testRedisClient = null;
  redisClient?.disconnect();
  redisClient = null;
}
