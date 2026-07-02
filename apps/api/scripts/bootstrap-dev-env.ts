/**
 * Dev-only env defaults for forensic Postgres + Telegram delivery pipeline.
 * Loaded by `pnpm run dev` before main.ts. Skipped for NODE_ENV=test|production.
 * Explicit env vars always win.
 */

function applyDevDefault(name: string, value: string): void {
  const current = process.env[name]?.trim();
  if (current === undefined || current.length === 0) {
    process.env[name] = value;
  }
}

function isDevBoot(): boolean {
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  return nodeEnv !== "test" && nodeEnv !== "production";
}

if (isDevBoot() && process.env.DATABASE_URL?.trim()) {
  applyDevDefault("STORAGE_DRIVER", "prisma");
  applyDevDefault("OUTBOX_RELAY_ENABLED", "true");
  applyDevDefault("INTEGRATION_DELIVERY_ENABLED", "true");
  applyDevDefault("INTEGRATION_DELIVERY_WORKER_ENABLED", "true");
  applyDevDefault("MINIO_ENDPOINT", "http://127.0.0.1:9002");
  applyDevDefault("MINIO_ACCESS_KEY", "minioadmin");
  applyDevDefault("MINIO_SECRET_KEY", "minioadmin");
  applyDevDefault("MINIO_BUCKET", "app-tour-dev");
}
