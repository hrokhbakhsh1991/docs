/**
 * Phase 4–5 transactional chain integrity under crash (chaos).
 *
 * Subprocess model (required for SIGKILL isolation):
 * - Parent spawns `atomic-crash-worker.ts` per iteration via `child_process.spawn`.
 * - Worker runs one `persistNewTourAtomically` with `P5_CHAOS_ABORT`:
 *   - `pre_commit` | `before_outbox` | `outbox` — throw inside `withCanonicalTransaction`
 *   - `sigkill` — sleep in open TX then self-SIGKILL; parent also SIGKILLs early (best-effort)
 * - After each child exit, parent runs consistency audit on admin connection:
 *   orphan tours (no TourCreated outbox), orphan outbox, audit without tour.
 *
 * Primary atomicity proof: throw-based `pre_commit` abort. SIGKILL is best-effort mid-TX.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { persistNewTourAtomically } from "../../src/canonical/atomic-canonical-tour-persist";
import {
  clearPreTransactionValidationGate,
  runPreTransactionValidation,
} from "../../src/canonical/pre-transaction-validation";
import { disconnectPrisma } from "../../src/db/prisma";
import { integrationTenantId } from "../test-helpers";
import { skipUnlessNightlyTier } from "../test-tier";
import {
  assertZeroOrphanedState,
  auditTenantConsistency,
  partialWriteCount,
} from "./chaos-db-assertions";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const CHAOS_DIR = dirname(fileURLToPath(import.meta.url));
const CRASH_WORKER = join(CHAOS_DIR, "atomic-crash-worker.ts");
const REPO_ROOT = join(CHAOS_DIR, "../../../..");
const CHAOS_REPORT = join(REPO_ROOT, "docs/phase-5/audits/CHAOS-TRANSACTION-REPORT.md");

const ITERATIONS = Number.parseInt(process.env.P5_CHAOS_ITERATIONS?.trim() ?? "30", 10);
const ABORT_MODES = ["pre_commit", "sigkill", "before_outbox", "outbox"] as const;
const PARENT_KILL_MS = Number.parseInt(process.env.P5_CHAOS_PARENT_KILL_MS?.trim() ?? "400", 10);
const SIGKILL_SLEEP_MS = Number.parseInt(process.env.P5_CHAOS_SLEEP_MS?.trim() ?? "2500", 10);
const WORKER_TIMEOUT_MS = Number.parseInt(
  process.env.P5_CHAOS_WORKER_TIMEOUT_MS?.trim() ?? "15000",
  10
);

type AbortMode = (typeof ABORT_MODES)[number];

type IterationRow = {
  readonly iteration: number;
  readonly mode: AbortMode;
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly orphanTours: number;
  readonly orphanOutbox: number;
  readonly orphanAudit: number;
  readonly partialWrites: number;
  readonly pass: boolean;
};

function pickAbortMode(): AbortMode {
  return ABORT_MODES[Math.floor(Math.random() * ABORT_MODES.length)]!;
}

function spawnCrashWorker(args: {
  tenantId: string;
  markerTitle: string;
  mode: AbortMode;
}): Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", CRASH_WORKER], {
      env: {
        ...process.env,
        STORAGE_DRIVER: "prisma",
        P5_CHAOS_TENANT_ID: args.tenantId,
        P5_CHAOS_MARKER_TITLE: args.markerTitle,
        P5_CHAOS_ABORT: args.mode,
        P5_CHAOS_SLEEP_MS: String(SIGKILL_SLEEP_MS),
      },
      stdio: "pipe",
    });

    if (args.mode === "sigkill") {
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* child may already be dead */
        }
      }, PARENT_KILL_MS);
    }

    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        child.kill("SIGKILL");
      } catch {
        /* already dead */
      }
      resolve({ exitCode: null, signal: "SIGKILL" });
    }, WORKER_TIMEOUT_MS);

    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode, signal });
    });
  });
}

function writeChaosReport(rows: IterationRow[], verdict: "PASS" | "FAIL"): void {
  const totalPartial = rows.reduce((sum, row) => sum + row.partialWrites, 0);
  const lines = [
    "# Phase 5 — Chaos transaction integrity report",
    "",
    `report_date: ${new Date().toISOString().slice(0, 10)}`,
    `iterations: ${rows.length}`,
    `partial_write_count: ${totalPartial}`,
    `verdict: **${verdict}**`,
    "",
    "Cross-link: [HARDENED-GATE-REPORT.md](./HARDENED-GATE-REPORT.md)",
    "",
    "## Subprocess model",
    "",
    "- Worker: `apps/api/test/chaos/atomic-crash-worker.ts`",
    "- Parent: `apps/api/test/chaos/atomic-rollback-stress.spec.ts`",
    "- Primary proof: throw `pre_commit` before TX commit",
    "- SIGKILL: parent kill at ~400ms + worker self-kill after sleep (best-effort mid-TX)",
    "",
    "## Iteration table",
    "",
    "| # | mode | exit | signal | orphan_tours | orphan_outbox | orphan_audit | partial | pass |",
    "|---|------|------|--------|--------------|---------------|--------------|---------|------|",
  ];

  for (const row of rows) {
    lines.push(
      `| ${row.iteration} | ${row.mode} | ${row.exitCode ?? "null"} | ${row.signal ?? "—"} | ${row.orphanTours} | ${row.orphanOutbox} | ${row.orphanAudit} | ${row.partialWrites} | ${row.pass ? "PASS" : "FAIL"} |`
    );
  }

  lines.push("", "## Atomicity verdict", "");
  if (verdict === "PASS") {
    lines.push(
      "All iterations rolled back atomically — **zero** partial writes (tour + audit + outbox all-or-nothing)."
    );
  } else {
    lines.push(
      "**FAIL** — partial writes detected; inspect `withCanonicalTransaction` / `atomic-canonical-tour-persist.ts`."
    );
  }

  writeFileSync(CHAOS_REPORT, `${lines.join("\n")}\n`, "utf8");
}

/**
 * P5 chaos gate — repeated subprocess crash/abort must leave zero orphaned state.
 */
describe(
  "chaos atomic rollback stress (integration)",
  {
    skip: !hasDatabase
      ? "chaos atomic rollback requires DATABASE_URL"
      : skipUnlessNightlyTier("chaos atomic rollback stress (integration)"),
    concurrency: false,
  },
  () => {
    const tenantId = integrationTenantId();
    const runId = randomUUID().slice(0, 8);
    let admin: PrismaClient;
    const priorStorage = process.env.STORAGE_DRIVER;
    const priorAbort = process.env.P5_ATOMIC_TX_TEST_ABORT;
    const iterationRows: IterationRow[] = [];

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      await disconnectPrisma();
      admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `chaos-${runId}`,
          workspaceType: "starter",
          theme: {},
        },
      });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorStorage;
      process.env.P5_ATOMIC_TX_TEST_ABORT = priorAbort;
      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
      );
      try {
        const staleProcessing = await admin.outboxEvent.count({
          where: { tenantId, status: "processing" },
        });
        const maxProcessing = Number.parseInt(
          process.env.CHAOS_MAX_PROCESSING_ROWS?.trim() ?? "0",
          10
        );
        assert.ok(
          staleProcessing <= maxProcessing,
          `chaos tenant must not retain stale processing rows — got ${staleProcessing}, max ${maxProcessing} (DEC-089)`
        );

        await admin.auditEvent.deleteMany({ where: { tenantId } });
        await admin.outboxEvent.deleteMany({ where: { tenantId } });
        await admin.tour.deleteMany({ where: { tenantId } });
        await admin.tenant.deleteMany({ where: { id: tenantId } });
      } finally {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
        );
      }

      await admin.$disconnect();
      await disconnectPrisma();

      const verdict = iterationRows.every((row) => row.pass) ? "PASS" : "FAIL";
      if (iterationRows.length > 0) {
        writeChaosReport(iterationRows, verdict);
      }
    });

    it("subprocess loop: random abort modes leave zero orphans after each recovery", async () => {
      for (let i = 0; i < ITERATIONS; i += 1) {
        const mode = pickAbortMode();
        const markerTitle = `chaos-${runId}-${mode}-${i}`;

        const toursBefore = await admin.tour.count({ where: { tenantId } });
        const outboxBefore = await admin.outboxEvent.count({ where: { tenantId } });
        const auditsBefore = await admin.auditEvent.count({ where: { tenantId } });

        const { exitCode, signal } = await spawnCrashWorker({
          tenantId,
          markerTitle,
          mode,
        });

        if (mode !== "sigkill") {
          assert.notEqual(exitCode, 0, `iteration ${i}: throw mode must exit non-zero`);
        }

        const orphanResult = await assertZeroOrphanedState(admin, tenantId, {
          markerTitle,
          toursBefore,
          outboxBefore,
          auditsBefore,
        });

        const partialWrites = partialWriteCount(orphanResult);
        const pass = partialWrites === 0;

        iterationRows.push({
          iteration: i + 1,
          mode,
          exitCode,
          signal,
          orphanTours: orphanResult.toursWithoutOutbox,
          orphanOutbox: orphanResult.outboxWithoutTour,
          orphanAudit: orphanResult.auditWithoutTour,
          partialWrites,
          pass,
        });

        assert.ok(pass, `iteration ${i + 1} (${mode}): partial writes detected`);
      }
    });

    it("in-process pre_commit throw: audit + outbox + tour roll back together", async () => {
      const markerTitle = `chaos-${runId}-pre-commit-inline`;
      process.env.P5_ATOMIC_TX_TEST_ABORT = "pre_commit";

      const toursBefore = await admin.tour.count({ where: { tenantId } });
      const outboxBefore = await admin.outboxEvent.count({ where: { tenantId } });
      const auditsBefore = await admin.auditEvent.count({ where: { tenantId } });

      const canonical = await runPreTransactionValidation({
        body: {
          data: {
            basics: { title: markerTitle },
            details: { summary: "pre-commit" },
          },
        },
        tenantId,
        workspaceType: "starter",
      });

      await assert.rejects(
        () => persistNewTourAtomically({ tenantId, canonical }),
        /P5_ATOMIC_TX_TEST_ABORT/
      );
      clearPreTransactionValidationGate();

      await assertZeroOrphanedState(admin, tenantId, {
        markerTitle,
        toursBefore,
        outboxBefore,
        auditsBefore,
      });
    });

    it("happy-path control after chaos bursts leaves paired tour+outbox+audit", async () => {
      delete process.env.P5_ATOMIC_TX_TEST_ABORT;
      const markerTitle = `chaos-${runId}-control`;

      const canonical = await runPreTransactionValidation({
        body: {
          data: {
            basics: { title: markerTitle },
            details: { summary: "control" },
          },
        },
        tenantId,
        workspaceType: "starter",
      });

      const result = await persistNewTourAtomically({ tenantId, canonical });
      clearPreTransactionValidationGate();

      const consistency = await auditTenantConsistency(admin, tenantId);
      assert.equal(consistency.toursWithoutOutbox, 0);
      assert.equal(consistency.outboxWithoutTour, 0);
      assert.equal(consistency.auditWithoutTour, 0);

      const tour = await admin.tour.findUnique({
        where: { tenantId_id: { tenantId, id: result.id } },
      });
      assert.ok(tour);
      assert.equal(tour.title, markerTitle);

      const outbox = await admin.outboxEvent.findMany({
        where: { tenantId, aggregateId: result.id, eventType: "TourCreated" },
      });
      assert.equal(outbox.length, 1);
      assert.equal(outbox[0]?.status, "pending");

      const audit = await admin.auditEvent.findFirst({
        where: { tenantId, entityId: result.id, entityType: "tour" },
      });
      assert.ok(audit);
    });
  }
);
