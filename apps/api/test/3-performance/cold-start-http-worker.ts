/**
 * Isolated subprocess for cold-start HTTP TTFB measurement.
 *
 * CS-UNSC-02 — emits COLD_START_READY as soon as the socket binds; platform-core loads
 * on first GET /probe only (see cold-start-http-probe.ts).
 *
 * Env:
 *   COLD_START_CELL_COUNT — ruleSet.cells cardinality (default 256, max 256)
 */
import http from "node:http";

const cellCount = Number.parseInt(process.env.COLD_START_CELL_COUNT ?? "256", 10);
const tenantId = process.env.COLD_START_TENANT_ID?.trim() ?? "cold-start-tenant";

const server = http.createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/probe") {
      const { runColdStartHttpProbe } = await import("./cold-start-http-probe");
      const { initMs, ok } = await runColdStartHttpProbe(cellCount, tenantId);
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
  })();
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
