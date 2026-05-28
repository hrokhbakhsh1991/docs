#!/usr/bin/env node
/**
 * Builds an NDJSON sample from live API/BFF error responses (structured envelope).
 * Use when you do not yet have a production log drain export.
 *
 *   node scripts/generate-production-log-sample.mjs > /tmp/sample.ndjson
 *   PRODUCTION_LOG_SAMPLE=/tmp/sample.ndjson pnpm infra:signoff
 */
const API = process.env.API_PORT ?? "3001";
const WEB = process.env.WEB_PORT ?? "3000";

async function record(status, body, requestId) {
  const code =
    body?.error?.code ??
    body?.error_code ??
    body?.code ??
    (typeof body?.error === "string" ? body.error : undefined);
  return JSON.stringify({
    level: status >= 500 ? "error" : "warn",
    status,
    error_code: code,
    message: body?.error?.message ?? body?.message ?? "http_request_failed",
    request_id: requestId ?? body?.error?.requestId ?? body?.requestId,
  });
}

async function main() {
  const lines = [];

  const noAuth = await fetch(`http://127.0.0.1:${API}/api/v2/tours`, {
    headers: { Host: `ws1-rbac.localhost:${WEB}` },
  });
  const noAuthBody = await noAuth.json().catch(() => ({}));
  lines.push(await record(noAuth.status, noAuthBody));

  const badOtp = await fetch(`http://ws1-rbac.localhost:${WEB}/api/auth/login-web-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+15550009999", otp: "0000" }),
  });
  const badBody = await badOtp.json().catch(() => ({}));
  lines.push(await record(badOtp.status, badBody));

  const ok = await fetch(`http://127.0.0.1:${API}/health`);
  lines.push(JSON.stringify({ level: "info", status: ok.status, message: "http_request_completed" }));

  process.stdout.write(`${lines.join("\n")}\n`);
}

main().catch((_e) => {
  process.exit(1);
});
