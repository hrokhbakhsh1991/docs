#!/usr/bin/env node
/**
 * Tour workspace end-to-end API audit — all tabs' data sources.
 * Usage: node apps/web/scripts/audit-tour-workspace.mjs [tourId]
 */
import { resolveOperatorSmokeOwnerMobile } from "./operator-smoke-identity.mjs";

const API = (process.env.TOUR_OPS_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const WEB = (process.env.WEB_BASE_URL ?? "http://admin.denali.localhost:3000").replace(/\/$/, "");
const SESSION_COOKIE = "atour_op_session";
const TENANT = process.env.OPERATOR_SMOKE_TENANT_ID ?? "00000000-0000-4000-8000-000000000014";
const DEFAULT_TOUR =
  process.argv[2]?.trim() || process.env.QA_TOUR_ID?.trim() || "00000000-0000-4000-8000-000000000210";
const MOBILE = resolveOperatorSmokeOwnerMobile();
const OTP = process.env.OPERATOR_DEV_OTP?.trim() || "1234";

/** @type {{ area: string; scenario: string; result: "PASS"|"FAIL"|"EMPTY"|"SKIP"; notes: string }[]} */
const rows = [];

function record(area, scenario, result, notes = "") {
  rows.push({ area, scenario, result, notes });
}

async function apiJson(path, init = {}) {
  const res = await fetch(`${API}${path}`, init);
  const text = await res.text();
  let body = null;
  try {
    body = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function webJson(path, cookie) {
  const res = await fetch(`${WEB}${path}`, {
    headers: { cookie },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function login() {
  const otpRes = await fetch(`${WEB}/api/auth/request-otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: MOBILE }),
  });
  if (!otpRes.ok) {
    throw new Error(`OTP request failed: ${otpRes.status}`);
  }
  const otpBody = await otpRes.json();
  const challengeId = otpBody.challenge_id;
  if (!challengeId) {
    throw new Error("No challenge_id in OTP response");
  }
  const loginRes = await fetch(`${WEB}/api/auth/login-web-session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: MOBILE, otp: OTP, challenge_id: challengeId }),
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status}`);
  }
  const loginBody = await loginRes.json();
  const token = loginBody.session_token;
  if (!token) {
    throw new Error("No session token in login response");
  }
  return `${SESSION_COOKIE}=${token}`;
}

async function auditTour(tourId, cookie) {
  const tourRes = await webJson(`/api/tours/${encodeURIComponent(tourId)}`, cookie);
  if (tourRes.status === 200) {
    const body = tourRes.body ?? {};
    const p = body.projection ?? body;
    const title =
      p?.title ??
      body.canonical?.roots?.title ??
      body.canonical?.title ??
      "?";
    const accepted = p?.acceptedCount ?? body.acceptedCount ?? "?";
    record("Shell", "Tour detail projection", "PASS", `title=${title} accepted=${accepted}`);
  } else {
    record("Shell", "Tour detail projection", "FAIL", `HTTP ${tourRes.status}`);
  }

  for (const status of ["pending", "waitlisted", "approved", "all"]) {
    const qs = new URLSearchParams({
      view: "ops",
      tourId,
      status,
      limit: "5",
    });
    const res = await webJson(`/api/bookings?${qs}`, cookie);
    const total = res.body?.total ?? res.body?.items?.length ?? 0;
    const tab =
      status === "pending"
        ? "Registrations (pending subset)"
        : status === "waitlisted"
          ? "Waitlist"
          : status === "approved"
            ? "Transport badge source"
            : "Registrations (all)";
    if (res.status === 200) {
      record(tab, `bookings status=${status}`, total > 0 ? "PASS" : "EMPTY", `total=${total}`);
    } else {
      record(tab, `bookings status=${status}`, "FAIL", `HTTP ${res.status}`);
    }
  }

  const rosterRes = await webJson(
    `/api/tours/${encodeURIComponent(tourId)}/operational-roster?filter=operational`,
    cookie
  );
  if (rosterRes.status === 200) {
    const count = rosterRes.body?.items?.length ?? 0;
    record("Transport", "operational-roster operational", count > 0 ? "PASS" : "EMPTY", `items=${count}`);
  } else {
    const code = rosterRes.body?.code ?? rosterRes.body?.error ?? "";
    record("Transport", "operational-roster operational", "FAIL", `HTTP ${rosterRes.status} ${code}`);
  }

  for (const filter of ["final", "unpaid", "paid"]) {
    const res = await webJson(
      `/api/tours/${encodeURIComponent(tourId)}/operational-roster?filter=${filter}`,
      cookie
    );
    const count = res.body?.items?.length ?? 0;
    if (res.status === 200) {
      record("Transport", `roster filter=${filter}`, count > 0 ? "PASS" : "EMPTY", `items=${count}`);
    } else {
      record("Transport", `roster filter=${filter}`, "FAIL", `HTTP ${res.status}`);
    }
  }

  const outstanding = await webJson(
    `/api/finance/reports/outstanding-balances?tourId=${encodeURIComponent(tourId)}&limit=10`,
    cookie
  );
  if (outstanding.status === 200) {
    const count = outstanding.body?.items?.length ?? 0;
    record("Finance", "outstanding-balances", count > 0 ? "PASS" : "EMPTY", `items=${count}`);
  } else {
    record("Finance", "outstanding-balances", "FAIL", `HTTP ${outstanding.status}`);
  }

  const collections = await webJson(
    `/api/finance/reports/tour-collections?tourId=${encodeURIComponent(tourId)}`,
    cookie
  );
  if (collections.status === 200) {
    const count = collections.body?.items?.length ?? 0;
    record("Finance", "tour-collections rollup", count > 0 ? "PASS" : "EMPTY", `items=${count}`);
  } else {
    record("Finance", "tour-collections rollup", "FAIL", `HTTP ${collections.status}`);
  }

  const receipts = await webJson(
    `/api/finance/receipts/pending?tourId=${encodeURIComponent(tourId)}&limit=10`,
    cookie
  );
  if (receipts.status === 200) {
    const count = receipts.body?.items?.length ?? 0;
    record("Finance", "pending receipts", count > 0 ? "PASS" : "EMPTY", `items=${count}`);
  } else {
    record("Finance", "pending receipts", "FAIL", `HTTP ${receipts.status}`);
  }
}

async function main() {
  console.log(`Audit tour workspace — API ${API} WEB ${WEB}`);
  const cookie = await login();
  record("Auth", "Operator OTP login", "PASS", MOBILE);

  await auditTour(DEFAULT_TOUR, cookie);

  const heavyTour = process.env.HEAVY_TOUR_ID?.trim();
  if (heavyTour && heavyTour.length > 0 && heavyTour !== DEFAULT_TOUR) {
    console.log(`\n--- Heavy tour ${heavyTour} ---`);
    await auditTour(heavyTour, cookie);
  }

  console.log("\n| Area | Scenario | Result | Notes |");
  console.log("| --- | --- | --- | --- |");
  for (const row of rows) {
    console.log(`| ${row.area} | ${row.scenario} | ${row.result} | ${row.notes} |`);
  }

  const fails = rows.filter((r) => r.result === "FAIL").length;
  process.exit(fails > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
