#!/usr/bin/env node
/**
 * DEC-086 — replay terminal failed outbox rows for a tenant.
 * @see docs/phase-5/appendices/outbox-failed-replay.md
 *
 * Usage:
 *   pnpm run outbox:replay-failed -- --tenant=<uuid> [--id=<uuid>]
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readArg(name) {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length).trim();
    }
  }
  return undefined;
}

const tenantId = readArg("tenant");
const outboxId = readArg("id");

if (!tenantId) {
  console.error("outbox:replay-failed: --tenant=<uuid> required");
  process.exit(1);
}

const script = `
import { replayFailedOutboxEvent } from "./src/outbox/outbox-replay.ts";
import { getPrismaAdmin } from "./src/db/prisma.ts";
import { disconnectPrisma } from "./src/db/prisma.ts";

const tenantId = ${JSON.stringify(tenantId)};
const outboxId = ${JSON.stringify(outboxId ?? null)};

const admin = getPrismaAdmin();
const rows = outboxId
  ? [{ id: outboxId }]
  : await admin.outboxEvent.findMany({
      where: { tenantId, status: "failed" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

if (rows.length === 0) {
  console.log("outbox:replay-failed: no failed rows");
  process.exit(0);
}

for (const row of rows) {
  await replayFailedOutboxEvent({ tenantId, outboxId: row.id, skipDevOnlyGate: true });
  console.log("replayed", row.id);
}

await disconnectPrisma();
`;

const result = spawnSync(process.execPath, ["--import", "tsx", "-e", script], {
  cwd: ROOT,
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
