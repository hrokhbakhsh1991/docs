#!/usr/bin/env node
/**
 * Live workspace isolation probe — dev hosts + API JWT/header forgery.
 * Run while API (3001) + Web (3000) are up.
 */
import http from "node:http";

const DENALI = "00000000-0000-4000-8000-000000000003";
const TENANT_A = "00000000-0000-4000-8000-000000000001";
const TENANT_B = "00000000-0000-4000-8000-000000000002";
const URBAN = "00000000-0000-4000-8000-000000000004";
const OPERATOR = "00000000-0000-4000-8000-000000000014";
const OWNER_MOBILE = "09174070937";
const DEV_OTP = "1234";

const WEB = "127.0.0.1";
const WEB_PORT = 3000;
const API = "127.0.0.1";
const API_PORT = 3001;

const HOSTS = [
  { label: "denali", host: "denali.localhost:3000", tenant: DENALI, loginAllowed: true },
  { label: "operator", host: "operator.localhost:3000", tenant: OPERATOR, loginAllowed: false },
  { label: "urban", host: "urban.localhost:3000", tenant: URBAN, loginAllowed: false },
  { label: "tenant-a", host: "tenant-a.localhost:3000", tenant: TENANT_A, loginAllowed: false },
  { label: "tenant-b", host: "tenant-b.localhost:3000", tenant: TENANT_B, loginAllowed: false },
  { label: "localhost", host: "localhost:3000", tenant: DENALI, loginAllowed: true },
];

/** @type {{ name: string; pass: boolean; detail: string }[]} */
const results = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function httpRequest({ hostname, port, path, method = "GET", headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        hostname,
        port,
        path,
        method,
        headers: {
          ...(payload
            ? { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(payload)) }
            : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = raw.length > 0 ? JSON.parse(raw) : null;
          } catch {
            json = raw;
          }
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: json,
            raw,
          });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(15_000, () => {
      req.destroy();
      reject(new Error(`timeout ${method} ${hostname}:${port}${path}`));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function webLogin(hostHeader) {
  const otpRes = await httpRequest({
    hostname: WEB,
    port: WEB_PORT,
    path: "/api/auth/request-otp",
    method: "POST",
    headers: { Host: hostHeader, "Content-Type": "application/json" },
    body: { phone: OWNER_MOBILE },
  });
  const challengeId = otpRes.body?.challenge_id;
  if (!challengeId) {
    return { ok: false, reason: `request-otp failed status=${otpRes.status}` };
  }
  const loginRes = await httpRequest({
    hostname: WEB,
    port: WEB_PORT,
    path: "/api/auth/login-web-session",
    method: "POST",
    headers: { Host: hostHeader, "Content-Type": "application/json" },
    body: { phone: OWNER_MOBILE, otp: DEV_OTP, challenge_id: challengeId },
  });
  if (loginRes.body?.ok === true && loginRes.body?.session_token) {
    return {
      ok: true,
      token: loginRes.body.session_token,
      tenantId: loginRes.body.tenant_id,
    };
  }
  if (loginRes.body?.requires_registration === true) {
    return { ok: false, reason: "requires_registration" };
  }
  return { ok: false, reason: `login status=${loginRes.status} body=${JSON.stringify(loginRes.body)}` };
}

async function webDashboardWithCookie(hostHeader, token) {
  const res = await httpRequest({
    hostname: WEB,
    port: WEB_PORT,
    path: "/dashboard",
    method: "GET",
    headers: { Host: hostHeader, Cookie: `session=${token}` },
  });
  const location = res.headers.location ?? "";
  const hasTenantMismatch = location.includes("tenant-mismatch");
  const blocked = res.status >= 300 && res.status < 400;
  const allowed = res.status === 200;
  return { status: res.status, location, blocked, allowed, hasTenantMismatch, raw: res.raw.slice(0, 200) };
}

async function apiGetSession(token) {
  return httpRequest({
    hostname: API,
    port: API_PORT,
    path: "/auth/session",
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function apiListTours(token, forgedTenantId) {
  return httpRequest({
    hostname: API,
    port: API_PORT,
    path: "/tours",
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-tenant-id": forgedTenantId,
      "x-authenticated-tenant-id": forgedTenantId,
      "x-user-id": "00000000-0000-4000-8000-000000000101",
      "x-actor-role": "owner",
      "x-membership-status": "ACTIVE",
      "x-workspace-id": "ws-forged",
    },
  });
}

async function apiListUsers(token, forgedTenantId) {
  return httpRequest({
    hostname: API,
    port: API_PORT,
    path: "/users",
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-tenant-id": forgedTenantId,
      "x-authenticated-tenant-id": forgedTenantId,
      "x-user-id": "00000000-0000-4000-8000-000000000101",
      "x-actor-role": "owner",
      "x-membership-status": "ACTIVE",
      "x-workspace-id": "ws-forged",
    },
  });
}

async function main() {
  console.log("=== Workspace isolation live probe ===\n");

  // 1) Per-host login matrix
  /** @type {Map<string, string>} */
  const tokensByHost = new Map();

  for (const h of HOSTS) {
    const login = await webLogin(h.host);
    if (h.loginAllowed) {
      record(
        `LOGIN:${h.label}`,
        login.ok && login.tenantId === h.tenant,
        login.ok ? `tenant=${login.tenantId}` : login.reason ?? "failed"
      );
      if (login.ok && login.token) tokensByHost.set(h.label, login.token);
    } else {
      record(
        `LOGIN:${h.label}`,
        !login.ok && login.reason === "requires_registration",
        login.ok ? `UNEXPECTED login tenant=${login.tenantId}` : login.reason ?? "blocked"
      );
    }
  }

  const denaliToken = tokensByHost.get("denali");
  if (!denaliToken) {
    record("SETUP", false, "Denali token missing — aborting cross-host probes");
    summarize();
    process.exit(1);
  }

  // 2) Cross-host cookie matrix (Denali session on every host)
  for (const h of HOSTS) {
    const dash = await webDashboardWithCookie(h.host, denaliToken);
    const shouldAllow = h.label === "denali" || h.label === "localhost";
    if (shouldAllow) {
      record(
        `WEB:denali-cookie→${h.label}/dashboard`,
        dash.allowed,
        `status=${dash.status}`
      );
    } else {
      record(
        `WEB:denali-cookie→${h.label}/dashboard`,
        dash.blocked && (dash.hasTenantMismatch || dash.location.includes("/auth/login")),
        `status=${dash.status} loc=${dash.location}`
      );
    }
  }

  // 3) API session tenant integrity
  const sess = await apiGetSession(denaliToken);
  record(
    "API:Denali JWT /auth/session",
    sess.status === 200 && sess.body?.tenantId === DENALI,
    `status=${sess.status} tenant=${sess.body?.tenantId}`
  );

  // 4) API forged header matrix — must not return other tenant data
  const forgedTargets = [
    { label: "operator", id: OPERATOR },
    { label: "urban", id: URBAN },
    { label: "tenant-a", id: TENANT_A },
    { label: "tenant-b", id: TENANT_B },
  ];

  for (const target of forgedTargets) {
    const tours = await apiListTours(denaliToken, target.id);
    const users = await apiListUsers(denaliToken, target.id);
    const toursOk =
      tours.status === 200 &&
      (tours.body?.items === undefined || Array.isArray(tours.body.items));
    const usersOk = users.status === 403 || users.status === 401 || users.status === 200;
    const noForeignTourIds =
      !Array.isArray(tours.body?.items) ||
      tours.body.items.every(
        (row) =>
          row?.tenantId === undefined ||
          row.tenantId === DENALI ||
          row.tenant_id === undefined ||
          row.tenant_id === DENALI
      );
    record(
      `API:Denali JWT + forged ${target.label} headers → GET /tours`,
      toursOk && noForeignTourIds,
      `status=${tours.status} count=${tours.body?.items?.length ?? 0}`
    );
    record(
      `API:Denali JWT + forged ${target.label} headers → GET /users`,
      usersOk,
      `status=${users.status}`
    );
  }

  // 5) BFF API routes must enforce host ↔ session binding
  for (const h of HOSTS.filter((x) => x.label !== "denali" && x.label !== "localhost")) {
    for (const apiPath of ["/api/auth/session", "/api/users", "/api/tours", "/api/bookings"]) {
      const res = await httpRequest({
        hostname: WEB,
        port: WEB_PORT,
        path: apiPath,
        method: "GET",
        headers: { Host: h.host, Cookie: `session=${denaliToken}` },
      });
      const blocked =
        res.status === 403 &&
        (res.body?.error?.code === "AUTH_TENANT_HOST_MISMATCH" ||
          res.body?.ok === false);
      record(
        `BFF:denali-cookie→${h.label} ${apiPath}`,
        blocked,
        `status=${res.status} code=${res.body?.error?.code ?? "n/a"}`
      );
    }
  }

  // 6) BFF allowed on matching host
  for (const apiPath of ["/api/users", "/api/tours"]) {
    const res = await httpRequest({
      hostname: WEB,
      port: WEB_PORT,
      path: apiPath,
      method: "GET",
      headers: { Host: "denali.localhost:3000", Cookie: `session=${denaliToken}` },
    });
    record(
      `BFF:denali-cookie→denali ${apiPath}`,
      res.status === 200,
      `status=${res.status}`
    );
  }

  summarize();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}

function summarize() {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== Summary: ${passed}/${results.length} passed ===`);
  if (failed.length > 0) {
    console.log("\nFailures:");
    for (const f of failed) {
      console.log(`  - ${f.name}: ${f.detail}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
