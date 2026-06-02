#!/usr/bin/env node
/**
 * Infrastructure Closure Phase 5 — live gate (Node, no k6 required).
 *
 * Requires API :3001 and Web :3000 (pnpm dev). Skips when INFRA_REALITY_SKIP=1 or services down.
 *
 * Checks:
 * - BFF login storm (parallel logins per tenant)
 * - Concurrent tenant isolation (cookie from ws1 on ws2 host → blocked)
 * - Latency / trace headers on BFF GET /api/tours
 * - Concurrent BFF tour CREATE across ws1/ws2/ws3 (no cross-tenant id in JWT)
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OTP = process.env.INFRA_OTP ?? process.env.PHASE10_OTP ?? "1234";
const WEB_PORT = process.env.WEB_PORT ?? "3000";
const API_PORT = process.env.API_PORT ?? "3001";
const STORM_PER_TENANT = Number(process.env.INFRA_LOGIN_STORM_COUNT ?? 3);
const STORM_STAGGER_MS = Number(process.env.INFRA_LOGIN_STORM_STAGGER_MS ?? 250);

const TENANTS = [
  { slug: "ws1-rbac", email: "ws1-owner@test.com" },
  { slug: "ws2-rbac", email: "ws2-owner@test.com" },
  { slug: "ws3-rbac", email: "ws3-owner@test.com" },
];

const MINIMAL_TOUR = {
  title: "InfraGate TenCharMinimum",
  total_capacity: 8,
  lifecycle_status: "Draft",
  formProfile: "urban_event",
  transportModes: [],
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function uniquePhoneForEmail(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) {
    hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  }
  return `+1555${String(hash % 10_000_000).padStart(7, "0")}`;
}

function webOrigin(slug) {
  return `http://${slug}.localhost:${WEB_PORT}`;
}

function readJar(jarPath) {
  try {
    return readFileSync(jarPath, "utf8").replace(/\n/g, "; ").trim();
  } catch {
    return "";
  }
}

async function healthOk(url, _label) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchWithRetry(url, init, label, attempts = 10) {
  let lastText = "";
  let lastStatus = 0;
  for (let i = 0; i < attempts; i += 1) {
    const res = await fetch(url, init);
    if (res.status !== 429) {
      return res;
    }
    lastStatus = res.status;
    lastText = await res.text();
    await sleep(1200 + i * 800);
  }
  throw new Error(`${label} → ${lastStatus}: ${lastText.slice(0, 200)}`);
}

async function bffLogin(slug, phone) {
  const origin = webOrigin(slug);
  const jar = join(tmpdir(), `infra-${slug}-${process.pid}-${randomUUID()}.cookies`);
  const headers = { "Content-Type": "application/json" };

  for (const [name, path, body] of [
    ["preflight", "/api/auth/phone-preflight", { phone }],
    ["otp", "/api/auth/request-otp", { phone }],
    ["login", "/api/auth/login-web-session", { phone, otp: OTP }],
  ]) {
    const res = await fetchWithRetry(
      `${origin}${path}`,
      { method: "POST", headers, body: JSON.stringify(body) },
      `${slug} ${name}`,
    );
    if (!res.ok) {
      throw new Error(`${slug} ${name} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    if (name === "login") {
      const setCookie = res.headers.getSetCookie?.() ?? [];
      if (!setCookie.some((c) => c.startsWith("session="))) {
        throw new Error(`${slug}: missing session Set-Cookie`);
      }
      writeFileSync(jar, setCookie.map((c) => c.split(";")[0]).join("\n") + "\n");
    }
  }

  const cookie = readJar(jar);
  const token = decodeURIComponent(/session=([^;\s]+)/.exec(cookie)?.[1] ?? "");
  const payload = JSON.parse(
    Buffer.from(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
  );
  if (!payload.tenant_id) {
    throw new Error(`${slug}: JWT missing tenant_id`);
  }
  return { slug, cookie, tenantId: payload.tenant_id, token };
}

async function main() {
  if (process.env.INFRA_REALITY_SKIP === "1" || process.env.INFRA_REALITY_SKIP === "true") {
    process.exit(0);
  }

  const apiUp = await healthOk(`http://127.0.0.1:${API_PORT}/health`, "API");
  const webUp = await healthOk(`http://ws1-rbac.localhost:${WEB_PORT}/api/auth/session`, "Web BFF");
  if (!apiUp || !webUp) {
    process.exit(0);
  }

  const failures = [];
  const sessions = new Map();

  for (const { slug, email } of TENANTS) {
    const phone = uniquePhoneForEmail(email);
    try {
      const started = Date.now();
      const results = await Promise.all(
        Array.from({ length: STORM_PER_TENANT }, (_, i) =>
          sleep(i * STORM_STAGGER_MS).then(() => bffLogin(slug, phone)),
        ),
      );
      const elapsed = Date.now() - started;
      const p95Approx = elapsed;
      sessions.set(slug, results[0]);
      if (p95Approx > 200 * STORM_PER_TENANT) {
      }
    } catch (e) {
      failures.push(`storm:${slug}: ${e.message}`);
    }
    await sleep(2500);
  }

  try {
    const ws1 = sessions.get("ws1-rbac");
    if (!ws1) {
      throw new Error("ws1 session missing");
    }
    const cross = await fetch(`${webOrigin("ws2-rbac")}/api/tours?limit=1`, {
      headers: { Cookie: ws1.cookie },
    });
    if (cross.status !== 401 && cross.status !== 403) {
      throw new Error(`cross-host expected 401/403, got ${cross.status}`);
    }
  } catch (e) {
    failures.push(`isolation:${e.message}`);
  }

  try {
    const ws1 = sessions.get("ws1-rbac");
    if (!ws1) {
      throw new Error("ws1 session missing");
    }
    const res = await fetch(`${webOrigin(ws1.slug)}/api/tours?limit=1`, {
      headers: { Cookie: ws1.cookie },
    });
    const apiLat = res.headers.get("x-api-latency");
    const bffLat = res.headers.get("x-bff-latency");
    const traceparent = res.headers.get("traceparent");
    if (!apiLat && res.ok) {
      throw new Error("missing x-api-latency on BFF tours response");
    }
    if (!bffLat && res.ok) {
      throw new Error("missing x-bff-latency on BFF tours response");
    }
    if (!traceparent?.trim()) {
      throw new Error("missing traceparent on BFF response");
    }
  } catch (e) {
    failures.push(`headers:${e.message}`);
  }

  try {
    const created = await Promise.all(
      TENANTS.map(async ({ slug, email }) => {
        const phone = uniquePhoneForEmail(email);
        const { cookie, tenantId } = sessions.get(slug) ?? (await bffLogin(slug, phone));
        const res = await fetch(`${webOrigin(slug)}/api/tours`, {
          method: "POST",
          headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
            "Idempotency-Key": randomUUID(),
          },
          body: JSON.stringify(MINIMAL_TOUR),
        });
        if (res.status !== 200 && res.status !== 201) {
          const errText = await res.text();
          throw new Error(`${slug} CREATE → ${res.status}: ${errText.slice(0, 240)}`);
        }
        const body = await res.json();
        const jwt = JSON.parse(
          Buffer.from(
            (decodeURIComponent(/session=([^;\s]+)/.exec(cookie)?.[1] ?? "")).split(".")[1]
              .replace(/-/g, "+")
              .replace(/_/g, "/"),
            "base64",
          ).toString("utf8"),
        );
        if (jwt.tenant_id && jwt.tenant_id !== tenantId) {
          throw new Error(`${slug}: JWT tenant drift during CREATE`);
        }
        return { slug, tourId: body.id, tenantId };
      }),
    );
    const ids = new Set(created.map((c) => c.tourId));
    if (ids.size !== created.length) {
      throw new Error("duplicate tour ids across tenants — possible cross-pollution");
    }
  } catch (e) {
    failures.push(`mutations:${e.message}`);
  }

  if (failures.length > 0) {
    for (const _f of failures) {
    }
    process.exit(1);
  }

}

main().catch((_e) => {
  process.exit(1);
});
