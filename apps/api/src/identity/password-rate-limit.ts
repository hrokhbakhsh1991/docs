import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import Redis from "ioredis";

const BUDGET_SCRIPT = `
  for i = 1, 3 do
    if tonumber(redis.call('GET', KEYS[i]) or '0') >= tonumber(ARGV[i * 2 - 1]) then return 0 end
  end
  for i = 1, 3 do
    local count = redis.call('INCR', KEYS[i])
    if count == 1 then redis.call('EXPIRE', KEYS[i], tonumber(ARGV[i * 2])) end
  end
  return 1
`;

export class PasswordRateLimitError extends Error {
  constructor(readonly code: "PASSWORD_RATE_LIMITED" | "PASSWORD_RATE_LIMIT_UNAVAILABLE") {
    super(code);
    this.name = "PasswordRateLimitError";
  }
}

type BudgetDependencies = {
  readonly secret: Buffer;
  readonly namespace: string;
  readonly evaluate: (keys: readonly string[]) => Promise<unknown>;
};

export async function consumePasswordAttemptBudget(
  input: { readonly mobile: string; readonly clientIp: string },
  dependencies: BudgetDependencies
): Promise<void> {
  if (
    dependencies.secret.length !== 32 ||
    !/^[a-z0-9_-]{1,40}$/.test(dependencies.namespace) ||
    isIP(input.clientIp) === 0
  ) {
    throw new PasswordRateLimitError("PASSWORD_RATE_LIMIT_UNAVAILABLE");
  }
  const digest = (kind: string, value: string) =>
    createHmac("sha256", dependencies.secret).update(`${kind}\0${value}`).digest("hex");
  const prefix = `password-auth:${dependencies.namespace}`;
  const keys = [
    `${prefix}:account:${digest("account", input.mobile)}`,
    `${prefix}:ip:${digest("ip", input.clientIp)}`,
    `${prefix}:global`,
  ];
  let result: unknown;
  try {
    result = await dependencies.evaluate(keys);
  } catch {
    throw new PasswordRateLimitError("PASSWORD_RATE_LIMIT_UNAVAILABLE");
  }
  if (result === 0) throw new PasswordRateLimitError("PASSWORD_RATE_LIMITED");
  if (result !== 1) throw new PasswordRateLimitError("PASSWORD_RATE_LIMIT_UNAVAILABLE");
}

let cached: { url: string; client: Redis } | undefined;

/** Shared across API instances. Missing configuration or Redis fails closed. */
export async function assertPasswordAttemptLimit(input: {
  readonly mobile: string;
  readonly clientIp?: string;
}): Promise<void> {
  const url = process.env.REDIS_URL?.trim();
  const encodedSecret = process.env.PASSWORD_AUTH_RATE_LIMIT_SECRET?.trim();
  const namespace =
    process.env.APP_INFRA_PROFILE?.trim() || process.env.NODE_ENV?.trim() || "development";
  if (!url || !encodedSecret || !/^[0-9a-f]{64}$/i.test(encodedSecret)) {
    throw new PasswordRateLimitError("PASSWORD_RATE_LIMIT_UNAVAILABLE");
  }
  if (cached === undefined || cached.url !== url) {
    cached?.client.disconnect();
    const client = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 500,
      retryStrategy: () => null,
    });
    client.on("error", () => {});
    cached = { url, client };
  }
  const client = cached.client;
  try {
    await consumePasswordAttemptBudget(
      { mobile: input.mobile, clientIp: input.clientIp ?? "" },
      {
        secret: Buffer.from(encodedSecret, "hex"),
        namespace,
        evaluate: async (keys) => {
          if (client.status === "wait") await client.connect();
          return client.eval(BUDGET_SCRIPT, 3, ...keys, 5, 300, 30, 60, 120, 60);
        },
      }
    );
  } catch (error) {
    if (error instanceof PasswordRateLimitError && error.code === "PASSWORD_RATE_LIMITED")
      throw error;
    client.disconnect();
    cached = undefined;
    throw new PasswordRateLimitError("PASSWORD_RATE_LIMIT_UNAVAILABLE");
  }
}
