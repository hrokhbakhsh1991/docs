/**
 * Isolated subprocess for cold-start HTTP TTFB measurement.
 *
 * Simulates scale-to-zero wake-up:
 *   1. Fresh Node process loads workspace-sdk + platform-core modules.
 *   2. Large workspace plugin is materialized at module load (bundle already in memory).
 *   3. First GET /probe runs per-call PlatformWizardEngine validation (API validation path).
 *
 * Emits `COLD_START_READY {"port":N}` on stdout when listening.
 *
 * Env:
 *   COLD_START_CELL_COUNT — ruleSet.cells cardinality (default 256, max 256)
 */
import http from "node:http";
import { performance } from "node:perf_hooks";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import { createCanonicalDocument } from "@app-tour/workspace-sdk/canonical";

import { buildLargeWorkspacePlugin, COLD_START_CANONICAL_INPUT } from "./cold-start-fixtures";

const cellCount = Number.parseInt(process.env.COLD_START_CELL_COUNT ?? "256", 10);
const tenantId = process.env.COLD_START_TENANT_ID?.trim() ?? "cold-start-tenant";

/** Loaded at module init — models workspace plugin resolved before first HTTP request. */
const largePlugin = buildLargeWorkspacePlugin(cellCount);

function runFirstRequestValidation(): { readonly initMs: number; readonly ok: boolean } {
  const started = performance.now();
  const engine = PlatformWizardEngine.create(largePlugin);
  const document = createCanonicalDocument(COLD_START_CANONICAL_INPUT);
  const result = engine.validateCanonical(document, {
    tenantId,
    dimensions: { variant: "default" },
  });
  return { initMs: performance.now() - started, ok: result.ok };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method === "GET" && url.pathname === "/probe") {
    const { initMs, ok } = runFirstRequestValidation();
    const body = JSON.stringify({
      ok,
      initMs: Math.round(initMs * 100) / 100,
      cellCount,
    });
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(body)),
      "X-Rule-Engine-Init-Ms": String(Math.round(initMs * 100) / 100),
    });
    res.end(body);
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(0, "127.0.0.1", () => {
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    console.error("cold-start-http-worker: no listen address");
    process.exit(2);
  }
  process.stdout.write(`COLD_START_READY ${JSON.stringify({ port: addr.port })}\n`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
