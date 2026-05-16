#!/usr/bin/env node
/**
 * Phase 10.15–10.16 local gate: BFF login (3 tenants) + tour CREATE → PATCH → OPEN.
 * Requires API :3001 and Web :3000 (pnpm dev).
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OTP = process.env.PHASE10_OTP ?? "1234";

const TENANTS = [
  { slug: "ws1-rbac", email: "ws1-owner@test.com" },
  { slug: "ws2-rbac", email: "ws2-owner@test.com" },
  { slug: "ws3-rbac", email: "ws3-owner@test.com" },
];

const WS1_TENANT_ID = "00311449-1df0-4413-8d61-26c6ac82e9ed";
const WS1_MEMBER_USER_ID = "e4798084-ba13-46fd-84d9-c56942283304";

const MINIMAL_TOUR_BODY = {
  title: "Phase10Gate TenCharMinimumTitle",
  total_capacity: 12,
  lifecycle_status: "Draft",
  formProfile: "urban_event",
  transportModes: [],
};

function uniquePhoneForEmail(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) {
    hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  }
  const suffix = String(hash % 10_000_000).padStart(7, "0");
  return `+1555${suffix}`;
}

function tenantWebOrigin(slug) {
  return `http://${slug}.localhost:3000`;
}

function tenantApiOrigin(slug) {
  return `http://${slug}.localhost:3001`;
}

function readJar(jarPath) {
  try {
    return readFileSync(jarPath, "utf8").replace(/\n/g, "; ").trim();
  } catch {
    return "";
  }
}

function sessionBearer(jarPath) {
  const m = /session=([^;\s]+)/.exec(readJar(jarPath));
  if (!m) {
    throw new Error("no session cookie");
  }
  return decodeURIComponent(m[1]);
}

function decodeJwtPayload(token) {
  const part = token.split(".")[1];
  if (!part) {
    throw new Error("invalid JWT");
  }
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

function assertSessionJwt(token, { slug }) {
  const p = decodeJwtPayload(token);
  if (!p.tenant_id || typeof p.tenant_id !== "string") {
    throw new Error(`${slug}: JWT missing tenant_id`);
  }
  if (!p.role || typeof p.role !== "string") {
    throw new Error(`${slug}: JWT missing role`);
  }
  if (p.sess_ver === undefined || p.sess_ver === null) {
    throw new Error(`${slug}: JWT missing sess_ver`);
  }
  if (!p.caps || typeof p.caps !== "string" || p.caps.includes("undefined")) {
    throw new Error(`${slug}: JWT caps snapshot missing or invalid`);
  }
  return p;
}

async function bffLogin(slug, phone) {
  const origin = tenantWebOrigin(slug);
  const jar = join(tmpdir(), `phase10-${slug}-${process.pid}.cookies`);

  const steps = [
    ["phone-preflight", "/api/auth/phone-preflight", { phone }],
    ["request-otp", "/api/auth/request-otp", { phone }],
    ["login-web-session", "/api/auth/login-web-session", { phone, otp: OTP }],
  ];

  for (const [name, path, body] of steps) {
    const res = await fetchWith429Retry(
      `${origin}${path}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      `${slug} ${name}`,
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${slug} ${name} → ${res.status}: ${text.slice(0, 400)}`);
    }
    if (name === "login-web-session") {
      const setCookie = res.headers.getSetCookie?.() ?? [];
      const session = setCookie.find((c) => c.startsWith("session="));
      if (!session) {
        throw new Error(`${slug} login: missing session Set-Cookie`);
      }
      writeFileSync(jar, setCookie.map((c) => c.split(";")[0]).join("\n") + "\n");
    }
  }

  const cookie = readJar(jar);
  const meRes = await fetch(`${origin}/api/me`, {
    headers: { Cookie: cookie },
  });
  if (!meRes.ok) {
    throw new Error(`${slug} GET /api/me → ${meRes.status}`);
  }
  const me = await meRes.json();

  const macRes = await fetch(`${tenantApiOrigin(slug)}/api/v2/auth/membership-ability-context`, {
    headers: {
      Host: `${slug}.localhost:3001`,
      Authorization: `Bearer ${sessionBearer(jar)}`,
    },
  });
  if (!macRes.ok) {
    throw new Error(`${slug} membership-ability-context → ${macRes.status}`);
  }

  const token = sessionBearer(jar);
  assertSessionJwt(token, { slug });
  return { slug, me, token };
}

/** API-only OTP login — avoids BFF auth rate limits during RBAC smoke extras. */
async function apiDirectLogin(slug, phone) {
  const api = tenantApiOrigin(slug);
  const host = `${slug}.localhost:3001`;
  const res = await fetchWith429Retry(
    `${api}/api/v2/auth/web/session/otp`,
    {
      method: "POST",
      headers: {
        Host: host,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone, otp: OTP }),
    },
    `${slug} api session/otp`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${slug} api login → ${res.status}: ${text.slice(0, 300)}`);
  }
  const body = await res.json();
  const token =
    typeof body.session_token === "string" ? body.session_token.trim() : "";
  if (!token) {
    throw new Error(`${slug} api login: missing session_token`);
  }
  assertSessionJwt(token, { slug });
  return token;
}

async function loginToken(slug, email) {
  return apiDirectLogin(slug, uniquePhoneForEmail(email));
}

async function rbacSmokeWs1(ownerToken, memberToken) {
  const api = tenantApiOrigin("ws1-rbac");
  const host = "ws1-rbac.localhost:3001";

  const ownerCreate = await fetch(`${api}/api/v2/tours`, {
    method: "POST",
    headers: {
      Host: host,
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(MINIMAL_TOUR_BODY),
  });
  if (ownerCreate.status !== 201) {
    throw new Error(`ws1 owner CREATE → ${ownerCreate.status}`);
  }

  const memberCreate = await fetch(`${api}/api/v2/tours`, {
    method: "POST",
    headers: {
      Host: host,
      Authorization: `Bearer ${memberToken}`,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(MINIMAL_TOUR_BODY),
  });
  if (memberCreate.status !== 403) {
    throw new Error(`ws1 member CREATE expected 403, got ${memberCreate.status}`);
  }

  const capBody = JSON.stringify({ capabilities: ["tour.update.core"] });
  const capKey = randomUUID();
  const capHeaders = {
    Host: host,
    Authorization: `Bearer ${ownerToken}`,
    "Content-Type": "application/json",
    "Idempotency-Key": capKey,
  };

  const capPatch = await fetch(
    `${api}/api/v2/workspaces/${WS1_TENANT_ID}/users/${WS1_MEMBER_USER_ID}/capabilities`,
    { method: "PATCH", headers: capHeaders, body: capBody },
  );
  if (capPatch.status !== 200) {
    const text = await capPatch.text();
    throw new Error(`ws1 PATCH capabilities → ${capPatch.status}: ${text.slice(0, 300)}`);
  }

  const capReplay = await fetch(
    `${api}/api/v2/workspaces/${WS1_TENANT_ID}/users/${WS1_MEMBER_USER_ID}/capabilities`,
    { method: "PATCH", headers: capHeaders, body: capBody },
  );
  if (capReplay.status !== 200) {
    throw new Error(`ws1 PATCH capabilities replay → ${capReplay.status}`);
  }

  const capNoKey = await fetch(
    `${api}/api/v2/workspaces/${WS1_TENANT_ID}/users/${WS1_MEMBER_USER_ID}/capabilities`,
    {
      method: "PATCH",
      headers: {
        Host: host,
        Authorization: `Bearer ${ownerToken}`,
        "Content-Type": "application/json",
      },
      body: capBody,
    },
  );
  if (capNoKey.status !== 400 && capNoKey.status !== 409 && capNoKey.status !== 422) {
    throw new Error(`ws1 PATCH capabilities without key expected 4xx, got ${capNoKey.status}`);
  }

  const ownerJwt = decodeJwtPayload(ownerToken);
  if (ownerJwt.tenant_id !== WS1_TENANT_ID) {
    throw new Error(`ws1 JWT tenant_id mismatch: ${ownerJwt.tenant_id}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWith429Retry(url, init, label, attempts = 8) {
  let lastStatus = 0;
  let lastText = "";
  for (let i = 0; i < attempts; i += 1) {
    const res = await fetch(url, init);
    if (res.status !== 429) {
      return res;
    }
    lastStatus = res.status;
    lastText = await res.text();
    await sleep(1200 + i * 700);
  }
  throw new Error(`${label} → ${lastStatus}: ${lastText.slice(0, 300)}`);
}

async function regionalScopeSmoke(ownerToken, leaderToken) {
  const slug = "ws2-rbac";
  const api = tenantApiOrigin(slug);
  const host = `${slug}.localhost:3001`;

  const createRes = await fetch(`${api}/api/v2/tours`, {
    method: "POST",
    headers: {
      Host: host,
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(MINIMAL_TOUR_BODY),
  });
  if (createRes.status !== 201) {
    throw new Error(`ws2 owner CREATE for regional smoke → ${createRes.status}`);
  }
  const { id: tourId } = await createRes.json();
  await waitForTourVisible(slug, ownerToken, tourId);
  await waitForTourVisible(slug, leaderToken, tourId);

  let lastStatus = 0;
  let lastText = "";
  for (let i = 0; i < 8; i += 1) {
    const patchRes = await fetch(`${api}/api/v2/tours/${tourId}`, {
      method: "PATCH",
      headers: {
        Host: host,
        Authorization: `Bearer ${leaderToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify({ title: "UpdatedTitle TwelveCharsMin" }),
    });
    if (patchRes.status === 403) {
      return;
    }
    lastStatus = patchRes.status;
    lastText = await patchRes.text();
    if (patchRes.status === 404 && i < 7) {
      await sleep(300 + i * 400);
      continue;
    }
    if (patchRes.status !== 403 && i < 7) {
      await sleep(200 + i * 200);
      continue;
    }
    break;
  }
  throw new Error(
    `ws2 regional leader PATCH expected 403, got ${lastStatus}: ${lastText.slice(0, 200)}`,
  );
}

async function waitForTourVisible(slug, token, tourId) {
  const api = tenantApiOrigin(slug);
  const host = `${slug}.localhost:3001`;
  const headers = { Host: host, Authorization: `Bearer ${token}` };

  for (let i = 0; i < 6; i += 1) {
    const res = await fetch(`${api}/api/v2/tours/${tourId}`, { headers });
    if (res.status === 200) {
      return;
    }
    await sleep(150 + i * 200);
  }
  throw new Error(`${slug} tour ${tourId} not visible after CREATE`);
}

async function patchTourOpen(slug, token, tourId) {
  const api = tenantApiOrigin(slug);
  const host = `${slug}.localhost:3001`;
  const body = JSON.stringify({
    description: "Phase 10 gate publish path",
    lifecycle_status: "OPEN",
  });

  let lastStatus = 0;
  let lastBody = "";
  for (let i = 0; i < 5; i += 1) {
    const patchRes = await fetch(`${api}/api/v2/tours/${tourId}`, {
      method: "PATCH",
      headers: {
        Host: host,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": randomUUID(),
      },
      body,
    });
    if (patchRes.status === 200) {
      return patchRes.json();
    }
    lastStatus = patchRes.status;
    lastBody = await patchRes.text();
    if (patchRes.status === 404 && i < 4) {
      await sleep(200 + i * 250);
      continue;
    }
    break;
  }
  throw new Error(`${slug} PATCH OPEN → ${lastStatus}: ${lastBody.slice(0, 500)}`);
}

async function tourLifecycle(slug, token) {
  const api = tenantApiOrigin(slug);
  const host = `${slug}.localhost:3001`;

  const createRes = await fetch(`${api}/api/v2/tours`, {
    method: "POST",
    headers: {
      Host: host,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(MINIMAL_TOUR_BODY),
  });
  if (createRes.status !== 201) {
    const body = await createRes.text();
    throw new Error(`${slug} CREATE → ${createRes.status}: ${body.slice(0, 500)}`);
  }
  const created = await createRes.json();
  const tourId = created.id;

  await waitForTourVisible(slug, token, tourId);
  const opened = await patchTourOpen(slug, token, tourId);
  if (opened.lifecycle_status !== "OPEN" && opened.lifecycleStatus !== "OPEN") {
    throw new Error(`${slug} expected OPEN, got ${JSON.stringify(opened.lifecycle_status)}`);
  }
  return tourId;
}

async function main() {
  const cooldownMs = Number(process.env.PHASE10_COOLDOWN_MS ?? 0);
  if (cooldownMs > 0) {
    await sleep(cooldownMs);
  }

  const failures = [];
  const ownerTokens = new Map();

  for (const { slug, email } of TENANTS) {
    const phone = uniquePhoneForEmail(email);
    try {
      let me;
      let token;
      let lastErr;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          ({ me, token } = await bffLogin(slug, phone));
          const tourId = await tourLifecycle(slug, token);
          ownerTokens.set(slug, token);
          if (!me?.id) {
            throw new Error(`${slug}: /api/me missing user id`);
          }
          console.log(`OK ${slug} user=${me.id} tour=${tourId}`);
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          if (attempt === 0) {
            await sleep(2000);
          }
        }
      }
      if (lastErr) {
        throw lastErr;
      }
    } catch (e) {
      failures.push(`${slug}: ${e.message}`);
      console.error(`FAIL ${slug}:`, e.message);
    }
    await sleep(2000);
  }

  try {
    const ws1Owner = ownerTokens.get("ws1-rbac");
    if (!ws1Owner) {
      throw new Error("ws1 owner token missing from login loop");
    }
    await sleep(2000);
    const memberToken = await loginToken("ws1-rbac", "ws1-member@test.com");
    await rbacSmokeWs1(ws1Owner, memberToken);
    console.log("OK ws1 RBAC smoke (member 403, capabilities PATCH + idempotency replay)");
    await sleep(2000);
    const ws2Owner = ownerTokens.get("ws2-rbac");
    if (!ws2Owner) {
      throw new Error("ws2 owner token missing from login loop");
    }
    const leaderToken = await loginToken("ws2-rbac", "ws2-leader@test.com");
    await regionalScopeSmoke(ws2Owner, leaderToken);
    console.log("OK ws2 regional scope (explicit tour.regional.manage only)");
  } catch (e) {
    failures.push(`rbac: ${e.message}`);
    console.error("FAIL rbac:", e.message);
  }

  if (failures.length > 0) {
    process.exit(1);
  }
  console.log("\n[verify-phase-10-gate] All checks passed.");
}

main();
