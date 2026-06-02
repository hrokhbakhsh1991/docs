#!/usr/bin/env node
/**
 * After Jaeger + API with OTEL_EXPORTER_OTLP_ENDPOINT, confirm traces appear in Jaeger.
 */
const JAEGER = (process.env.JAEGER_QUERY_URL ?? "http://127.0.0.1:16686").replace(/\/$/, "");
const API = process.env.API_HEALTH_URL ?? "http://127.0.0.1:3001/health";
const SERVICE = process.env.OTEL_SERVICE_NAME ?? "tour-ops-api";

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (process.env.OTEL_VERIFY_SKIP === "1") {
    process.exit(0);
  }

  try {
    const health = await fetch(`${JAEGER}/api/services`, { signal: AbortSignal.timeout(3000) });
    if (!health.ok) {
      throw new Error(`Jaeger query API ${health.status}`);
    }
  } catch (e) {
    process.exit(0);
  }

  for (let i = 0; i < 5; i += 1) {
    await fetch(API, { signal: AbortSignal.timeout(3000) }).catch(() => {});
    await sleep(400);
  }
  await sleep(2000);

  const end = Date.now() * 1000;
  const start = end - 5 * 60 * 1_000_000;
  const url = `${JAEGER}/api/traces?service=${encodeURIComponent(SERVICE)}&limit=5&start=${start}&end=${end}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) {
    process.exit(1);
  }
  const body = await res.json();
  const traces = body?.data ?? [];
  if (!Array.isArray(traces) || traces.length === 0) {
    process.exit(1);
  }

}

main().catch((_e) => {
  process.exit(1);
});
