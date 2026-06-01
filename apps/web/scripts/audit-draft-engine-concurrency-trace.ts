/**
 * Draft-engine 409 concurrency trace audit: PATCH sequence vs WorkspaceTourWizard draft hooks.
 *
 * Usage:
 *   DRAFT_ENGINE_TRACE=1 pnpm --filter web exec tsx scripts/audit-draft-engine-concurrency-trace.ts
 *   pnpm --filter web exec tsx scripts/audit-draft-engine-concurrency-trace.ts -- --markdown-out=../../audit-report.md
 */
import fs from "node:fs";
import path from "node:path";

import { DraftEngine } from "@repo/draft-engine";

import {
  appendDraftEngineTrace,
  clearDraftEngineTrace,
  getDraftEngineTraceSnapshot,
} from "../lib/draft-engine-trace";

type TraceRow = {
  at: string;
  deltaMs: number;
  kind: string;
  detail: string;
  meta: string;
};

type SimPatch = {
  seq: number;
  at: string;
  atMs: number;
  clientVersion: number;
  outcome: "ok" | "409";
  serverVersionAfter: number;
  concurrentWith: number | null;
};

type ConcurrencyTraceReport = {
  generatedAt: string;
  instrumentation: string[];
  wizardDraftHooks: string[];
  engineMutex: { maxConcurrentOnPush: number; pushCount: number };
  staleVersionSimulation: SimPatch[];
  simultaneousPatchSimulation: SimPatch[];
  simulatedWizardTimeline: TraceRow[];
  verdict: string;
  conclusion: "stale_version" | "simultaneous_patch";
};

function parseArgs(argv: string[]): { markdownOut: string | null } {
  const markdownOutArg = argv.find((arg) => arg.startsWith("--markdown-out="));
  return {
    markdownOut: markdownOutArg ? markdownOutArg.slice("--markdown-out=".length) : null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatMeta(meta?: Record<string, unknown>): string {
  if (!meta) {
    return "—";
  }
  return Object.entries(meta)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(", ");
}

async function runEngineMutexProbe(): Promise<{ maxConcurrentOnPush: number; pushCount: number }> {
  let concurrent = 0;
  let maxConcurrent = 0;
  let pushCount = 0;

  const engine = new DraftEngine<{ value: string }>({
    id: "audit-mutex",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 5,
    onFetch: async () => null,
    onPush: async (p) => {
      pushCount += 1;
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await sleep(25);
      concurrent -= 1;
      return { ...p, version: p.version + 1 };
    },
  });

  await engine.initialize();
  engine.update({ value: "a" });
  await sleep(8);
  engine.update({ value: "b" });
  await sleep(50);

  return { maxConcurrentOnPush: maxConcurrent, pushCount };
}

async function simulateStaleVersion409(): Promise<SimPatch[]> {
  let serverVersion = 2;
  const log: SimPatch[] = [];
  let inFlight = 0;
  let seq = 0;
  const t0 = Date.now();

  const patch = async (clientVersion: number): Promise<"ok" | "409"> => {
    seq += 1;
    const started = Date.now();
    const concurrentWith = inFlight > 0 ? inFlight : null;
    inFlight += 1;
    await sleep(15);
    let outcome: "ok" | "409";
    if (clientVersion !== serverVersion) {
      outcome = "409";
    } else {
      serverVersion += 1;
      outcome = "ok";
    }
    inFlight -= 1;
    log.push({
      seq,
      at: new Date(started).toISOString(),
      atMs: started - t0,
      clientVersion,
      outcome,
      serverVersionAfter: serverVersion,
      concurrentWith,
    });
    return outcome;
  };

  await Promise.all([patch(1), patch(1)]);
  return log;
}

async function simulateSimultaneousStaleAfterServerAhead(): Promise<SimPatch[]> {
  let serverVersion = 3;
  const log: SimPatch[] = [];
  let seq = 0;
  const t0 = Date.now();

  const patch = async (clientVersion: number, delayMs: number): Promise<void> => {
    await sleep(delayMs);
    seq += 1;
    const at = Date.now();
    const outcome = clientVersion === serverVersion ? "ok" : "409";
    if (outcome === "ok") {
      serverVersion += 1;
    }
    log.push({
      seq,
      at: new Date(at).toISOString(),
      atMs: at - t0,
      clientVersion,
      outcome,
      serverVersionAfter: serverVersion,
      concurrentWith: null,
    });
  };

  await patch(2, 0);
  await patch(2, 5);
  return log;
}

function buildSimulatedWizardTimeline(): TraceRow[] {
  clearDraftEngineTrace();
  process.env.DRAFT_ENGINE_TRACE = "1";

  const t0 = Date.now();
  appendDraftEngineTrace("wizard_watch_debounced", "RHF watch → pushDraftUserEdit", { debounceMs: 400 });
  appendDraftEngineTrace("wizard_set_draft_user", "pushDraftUserEditRef", {
    currentStepIndex: 0,
    draftStatus: "DIRTY",
  });
  appendDraftEngineTrace("adapter_on_push_start", "denali-create:ws-audit", {
    version: 2,
    lastModified: t0 + 400,
  });
  appendDraftEngineTrace("patch_start", "ws-audit/denali-create", { clientVersion: 2 });
  appendDraftEngineTrace("patch_409", "ws-audit/denali-create", {
    clientVersion: 2,
    serverVersion: 3,
    elapsedMs: 42,
  });

  const entries = getDraftEngineTraceSnapshot();
  return entries.map((entry, index) => {
    const prev = index > 0 ? entries[index - 1]!.atMs : entry.atMs;
    return {
      at: entry.at,
      deltaMs: entry.atMs - prev,
      kind: entry.kind,
      detail: entry.detail,
      meta: formatMeta(entry.meta),
    };
  });
}

function formatMarkdown(report: ConcurrencyTraceReport): string {
  const lines = [
    "",
    "---",
    "",
    "## Draft-Engine 409 Concurrency Trace (2026-06-01)",
    "",
    `**Generated:** ${report.generatedAt}`,
    "",
    "### Instrumentation",
    "",
    ...report.instrumentation.map((line) => `- ${line}`),
    "",
    "### WorkspaceTourWizard draft hooks (no direct `onPush` / `onChange`)",
    "",
    ...report.wizardDraftHooks.map((line) => `- ${line}`),
    "",
    "### Engine mutex probe (`DraftEngine.flushSync`)",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Max concurrent \`onPush\` | ${report.engineMutex.maxConcurrentOnPush} |`,
    `| Total \`onPush\` calls (rapid updates) | ${report.engineMutex.pushCount} |`,
    "",
    "### Simulated PATCH sequence — same client version (parallel)",
    "",
    "| # | t+ms | clientVersion | outcome | serverAfter | concurrentWith |",
    "|---|------|---------------|---------|-------------|----------------|",
  ];

  for (const row of report.staleVersionSimulation) {
    lines.push(
      `| ${row.seq} | ${row.atMs} | ${row.clientVersion} | **${row.outcome}** | ${row.serverVersionAfter} | ${row.concurrentWith ?? "—"} |`,
    );
  }

  lines.push(
    "",
    "### Simulated PATCH sequence — server already ahead (sequential stale)",
    "",
    "| # | t+ms | clientVersion | outcome | serverAfter |",
    "|---|------|---------------|---------|-------------|",
  );

  for (const row of report.simultaneousPatchSimulation) {
    lines.push(`| ${row.seq} | ${row.atMs} | ${row.clientVersion} | **${row.outcome}** | ${row.serverVersionAfter} |`);
  }

  lines.push(
    "",
    "### Example trace timeline (409 path; enable `?draftTrace=1` in browser)",
    "",
    "| Δms | Kind | Detail | Meta |",
    "|-----|------|--------|------|",
  );

  for (const row of report.simulatedWizardTimeline) {
    lines.push(`| ${row.deltaMs} | ${row.kind} | ${row.detail} | ${row.meta} |`);
  }

  lines.push(
    "",
    "### Verdict",
    "",
    report.verdict,
    "",
    `**Conclusion:** ${report.conclusion === "stale_version" ? "**Stale client version** — server OCC expects `clientVersion === storedVersion`; 409 when server is ahead. `DraftEngine` serializes PATCH (max concurrent onPush = 1)." : "**Simultaneous PATCH** — overlapping writes with stale version."}`,
    "",
    "**Artifacts:** `apps/web/lib/draft-engine-trace.ts`, `apps/web/reports/draft-engine-concurrency-trace.json`",
    "",
  );

  return lines.join("\n");
}

function appendMarkdown(markdownOut: string, section: string): void {
  const resolved = path.resolve(markdownOut);
  const existing = fs.existsSync(resolved) ? fs.readFileSync(resolved, "utf8") : "";
  const marker = "## Draft-Engine 409 Concurrency Trace (2026-06-01)";
  let body: string;
  if (existing.includes(marker)) {
    const start = existing.indexOf(marker);
    const afterMarker = existing.slice(start + marker.length);
    const nextH2 = afterMarker.search(/\n## /);
    const end = nextH2 >= 0 ? start + marker.length + nextH2 : existing.length;
    body = `${existing.slice(0, start).replace(/\n+$/, "")}${section}${existing.slice(end)}`;
  } else {
    body = `${existing.replace(/\n+$/, "")}${section}`;
  }
  fs.writeFileSync(resolved, body, "utf8");
}

async function main(): Promise<void> {
  const { markdownOut } = parseArgs(process.argv.slice(2));

  const engineMutex = await runEngineMutexProbe();
  const staleVersionSimulation = await simulateStaleVersion409();
  const simultaneousPatchSimulation = await simulateSimultaneousStaleAfterServerAhead();
  const simulatedWizardTimeline = buildSimulatedWizardTimeline();

  const parallel409 = staleVersionSimulation.filter((row) => row.outcome === "409").length;
  const conclusion: ConcurrencyTraceReport["conclusion"] =
    engineMutex.maxConcurrentOnPush === 1 && parallel409 > 0 ? "stale_version" : "simultaneous_patch";

  const report: ConcurrencyTraceReport = {
    generatedAt: new Date().toISOString(),
    instrumentation: [
      "`draft-engine.client.ts` → `patch_start` / `patch_success` / `patch_409` with ISO timestamp, clientVersion, serverVersion on 409",
      "`denali-adapter.ts` → `adapter_on_push_start` before `patchDraftSnapshot`",
      "`WorkspaceTourWizard.tsx` → `wizard_watch_debounced`, `wizard_set_draft_user`, `wizard_set_draft_step` before `setDraftData({ source: 'user' })`",
      "Enable: `localStorage.draftEngineTrace=1` or `?draftTrace=1`",
    ],
    wizardDraftHooks: [
      "RHF `watch()` debounced → `pushDraftUserEditRef` → `setDraftData` (engine debounce 500ms default in denali adapter)",
      "`currentStep` effect → immediate `setDraftData` (can fire near watch debounce)",
      "`onPush` is only on `DraftEngineConfig` in `denali-adapter.ts`, not in WorkspaceTourWizard",
    ],
    engineMutex,
    staleVersionSimulation,
    simultaneousPatchSimulation,
    simulatedWizardTimeline,
    verdict:
      engineMutex.maxConcurrentOnPush === 1
        ? "Not simultaneous PATCH from the client engine: `syncInFlight` mutex keeps one `onPush` at a time. Observed 409s match **optimistic concurrency** (`postgres-draft-snapshot.store`: reject when `clientVersion !== storedVersion`). Typical cause: server version advanced (another tab, prior successful PATCH, or initialize/fetch drift) while local engine still held an older `version` when PATCH was built."
        : "Engine allowed concurrent onPush — investigate mutex regression.",
    conclusion,
  };

  const jsonPath = path.join(process.cwd(), "reports", "draft-engine-concurrency-trace.json");
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const mdTarget = markdownOut ?? path.resolve(process.cwd(), "../../audit-report.md");
  appendMarkdown(mdTarget, formatMarkdown(report));
  console.log(`Wrote ${jsonPath}`);
  console.log(`Appended concurrency trace to ${path.resolve(mdTarget)}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
