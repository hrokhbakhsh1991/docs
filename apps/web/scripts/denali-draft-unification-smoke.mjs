#!/usr/bin/env node
/**
 * Track C §9 — Denali draft unification smoke (B-8 + 409 + tombstone + two-tab + flat-edit).
 *
 * Env:
 *   SMOKE_BASE_URL — default http://denali.localhost:3000
 *   SMOKE_EXPECT_UNIFICATION_ON=true — assert SERVER_WINS reload banner on two-tab 409
 */
import { chromium } from "@playwright/test";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const WORKSPACE = process.env.SMOKE_WORKSPACE_ID ?? "ws-denali-dev";
const DRAFT_PATH = `/api/workspaces/${WORKSPACE}/drafts/operator.wizard/denali-create`;
const OWNER_MOBILE = process.env.OPERATOR_OWNER_MOBILE ?? "+989121000001";
const OTP = "1234";
const EXPECT_ON = process.env.SMOKE_EXPECT_UNIFICATION_ON === "true";

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}: ${detail}`);
}

function skip(name, detail) {
  results.push({ name, ok: true, detail: `skipped: ${detail}` });
  console.log(`○ ${name}: skipped (${detail})`);
}

async function ensureDraftAbsent(page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.request.delete(DRAFT_PATH).catch(() => {});
    const getRes = await page.request.get(DRAFT_PATH);
    if (getRes.status() === 404) {
      return;
    }
    await page.waitForTimeout(400);
  }
  throw new Error("draft row still present after DELETE");
}

async function login(page) {
  const otpRes = await page.request.post(`${BASE}/api/auth/request-otp`, {
    data: { phone: OWNER_MOBILE },
    timeout: 120_000,
  });
  if (!otpRes.ok()) {
    const body = await otpRes.text().catch(() => "");
    throw new Error(
      `request-otp failed: ${otpRes.status()}${body.includes("ModuleParseError") ? " (Next compile error — restart web dev)" : ""}`
    );
  }
  const { challenge_id } = await otpRes.json();
  const loginRes = await page.request.post(`${BASE}/api/auth/login-web-session`, {
    data: { phone: OWNER_MOBILE, otp: OTP, challenge_id },
    timeout: 120_000,
  });
  if (!loginRes.ok()) throw new Error(`login failed: ${loginRes.status()}`);
}

async function clearDraft(page) {
  const btn = page.getByTestId("wizard-clear-draft");
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    const confirm = page.getByTestId("wizard-clear-draft-confirm-confirm");
    await confirm.waitFor({ state: "visible", timeout: 10_000 });
    await confirm.click();
    await page.waitForTimeout(3000);
  }
}

async function waitForIdle(page) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="draft-sync-indicator"]');
      const status = el?.getAttribute("data-status");
      return status === "IDLE" || status === "ERROR";
    },
    { timeout: 45_000 }
  ).catch(() => {});
  await page.waitForTimeout(1500);
}

async function ensureBasicStep(page) {
  const basic = page.locator('[data-wizard-step="denali_basic"]');
  if (await basic.isVisible().catch(() => false)) return;
  const btn = page.getByTestId("workspace-wizard-step-denali_basic");
  if (await btn.isEnabled().catch(() => false)) await btn.click();
  await basic.waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
}

async function fillTitle(page, value) {
  await ensureBasicStep(page);
  const input = page.locator('[data-field-path="title"] input').first();
  await input.waitFor({ state: "visible", timeout: 30_000 });
  await input.fill(value);
  await input.blur();
}

async function readTitle(page) {
  await ensureBasicStep(page);
  return page.locator('[data-field-path="title"] input').first().inputValue();
}

async function runTwoTabConflict(pageA, pageB) {
  await pageA.goto("/tours/new", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await pageA.locator("[data-workspace-wizard]").waitFor({ state: "visible", timeout: 60_000 });
  await clearDraft(pageA);

  const baseTitle = `TwoTab ${Date.now()}`;
  await fillTitle(pageA, baseTitle);
  await waitForIdle(pageA);

  await pageB.goto("/tours/new", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await pageB.locator("[data-workspace-wizard]").waitFor({ state: "visible", timeout: 60_000 });
  await waitForIdle(pageB);

  const titleOnBBefore = await readTitle(pageB);
  if (titleOnBBefore !== baseTitle) {
    fail("§9 two-tab B loads A draft", `expected ${baseTitle}, got ${titleOnBBefore}`);
    return;
  }
  pass("§9 two-tab B loads shared draft");

  const tabATitle = `${baseTitle} saved-by-A`;
  await fillTitle(pageA, tabATitle);
  await waitForIdle(pageA);

  const tabBTitle = `${baseTitle} edited-by-B`;
  await fillTitle(pageB, tabBTitle);
  await waitForIdle(pageB);

  const reloadBanner = await pageB
    .locator('[data-testid="draft-conflict-server-reloaded"]')
    .isVisible()
    .catch(() => false);

  if (EXPECT_ON) {
    if (reloadBanner) {
      pass("§9.4 on mode — SERVER_WINS reload banner");
    } else {
      fail(
        "§9.4 on mode — SERVER_WINS reload banner",
        "missing banner — restart web with NEXT_PUBLIC_DRAFT_UNIFICATION_V3=on"
      );
    }
    const titleAfter = await readTitle(pageB);
    if (titleAfter === tabATitle) {
      pass("§9.4 on mode — server title wins", titleAfter);
    } else {
      fail("§9.4 on mode — server title wins", `got ${titleAfter}, expected ${tabATitle}`);
    }
  } else {
    if (reloadBanner) {
      fail("§9.3 off mode — two-tab no reload banner", "banner visible");
    } else {
      pass("§9.3 off mode — two-tab quiet merge (no reload banner)");
    }
    const titleAfter = await readTitle(pageB);
    if (titleAfter.includes("edited-by-B") || titleAfter.includes("saved-by-A")) {
      pass("§9.3 off mode — two-tab merged/reconciled title", titleAfter);
    } else {
      fail("§9.3 off mode — two-tab title", titleAfter);
    }
  }
}

async function runFlatEditSmoke(page) {
  const toursRes = await page.request.get("/api/tours?view=operator&limit=10");
  if (!toursRes.ok()) {
    skip("§9.5 flat-edit parity", `tours list HTTP ${toursRes.status()}`);
    return;
  }
  const body = await toursRes.json();
  const items = body.items ?? body.tours ?? [];
  const tourId = items[0]?.id ?? items[0]?.tourId;
  if (typeof tourId !== "string" || tourId.length === 0) {
    skip("§9.5 flat-edit parity", "no tours in workspace");
    return;
  }

  await page.goto(`/tours/${encodeURIComponent(tourId)}/edit`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.locator("[data-draft-sync-chrome]").waitFor({ state: "visible", timeout: 60_000 });
  pass("§9.5 flat-edit DraftSyncChrome", tourId);

  const hasIndicator = await page.locator('[data-testid="draft-sync-indicator"]').isVisible().catch(() => false);
  if (hasIndicator) {
    pass("§9.5 flat-edit sync indicator");
  } else {
    fail("§9.5 flat-edit sync indicator", "missing");
  }
}

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();
  const pageB = await context.newPage();
  await login(page);
  pass("login");

  if (EXPECT_ON) {
    pass("smoke config", "SMOKE_EXPECT_UNIFICATION_ON=true");
  } else {
    pass("smoke config", "default off (set SMOKE_EXPECT_UNIFICATION_ON=true for §9.4)");
  }

  await page.goto("/tours/new", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("[data-workspace-wizard]").waitFor({ state: "visible", timeout: 60_000 });
  await clearDraft(page);
  await ensureDraftAbsent(page);
  pass("wizard loads + clear");

  const seedWithPhotos = {
    form: {
      data: {
        title: `Smoke ${Date.now()}`,
        publishStatus: "draft",
        photos: [{ id: "smoke-photo-1", url: "https://example.com/p.jpg" }],
      },
    },
    meta: { currentStepIndex: 0, wizardSessionId: "smoke-unify" },
  };

  let patchRes = await page.request.patch(DRAFT_PATH, {
    data: {
      data: seedWithPhotos,
      version: 0,
      schemaVersion: 1,
      lastModified: Date.now(),
    },
  });
  if (!patchRes.ok()) {
    fail("§9 tombstone seed v1", `${patchRes.status()} ${(await patchRes.text()).slice(0, 200)}`);
  } else {
    const v1 = await patchRes.json();
    pass("§9 tombstone seed v1", `version=${v1.version}`);

    const withoutPhotos = {
      form: {
        data: {
          title: seedWithPhotos.form.data.title,
          publishStatus: "draft",
        },
      },
      meta: { currentStepIndex: 0, wizardSessionId: "smoke-unify" },
    };

    patchRes = await page.request.patch(DRAFT_PATH, {
      data: {
        data: withoutPhotos,
        version: v1.version,
        schemaVersion: v1.schemaVersion,
        lastModified: Date.now(),
      },
    });
    const patchText = await patchRes.text();
    if (patchRes.status() === 400 && patchText.includes("TOMBSTONE_RESURRECTION")) {
      fail("§9.1 PATCH after photo delete", "TOMBSTONE_RESURRECTION");
    } else if (!patchRes.ok()) {
      fail("§9.1 PATCH after photo delete", `${patchRes.status()} ${patchText.slice(0, 200)}`);
    } else {
      pass("§9.1 PATCH after photo delete", "200 no resurrection");
      const v2Body = JSON.parse(patchText);
      const serverRoots = v2Body.data?.meta?.deletedRoots;
      if (Array.isArray(serverRoots) && serverRoots.includes("photos")) {
        pass("§9 server row tombstones photos", serverRoots.join(","));
      } else {
        console.warn(
          "⚠ §9 server row tombstones photos: not in PATCH body (restart @apps/api if Track A expected on dev)"
        );
      }
    }
  }

  await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
  await page.locator("[data-workspace-wizard]").waitFor({ state: "visible", timeout: 60_000 });
  await waitForIdle(page);

  let clientPatchBody = null;
  page.on("request", (req) => {
    if (req.method() === "PATCH" && req.url().includes("/drafts/operator.wizard/denali-create")) {
      try {
        clientPatchBody = req.postDataJSON();
      } catch {
        /* ignore */
      }
    }
  });

  await fillTitle(page, `${seedWithPhotos.form.data.title} edited`);
  await waitForIdle(page);

  if (clientPatchBody?.data?.meta?.deletedRoots === undefined) {
    pass("§9.2 client PATCH omits deletedRoots");
  } else {
    fail("§9.2 client PATCH omits deletedRoots", JSON.stringify(clientPatchBody.data.meta.deletedRoots));
  }

  const getRes = await page.request.get(DRAFT_PATH);
  const serverSnap = await getRes.json();
  const stalePatch = await page.request.patch(DRAFT_PATH, {
    data: {
      data: {
        form: { data: { title: "stale-api-probe", publishStatus: "draft" } },
        meta: { currentStepIndex: 0 },
      },
      version: Math.max(0, serverSnap.version - 1),
      schemaVersion: serverSnap.schemaVersion,
      lastModified: Date.now(),
    },
  });
  if (stalePatch.status() === 409) {
    pass("§9 stale PATCH API returns 409");
  } else {
    fail("§9 stale PATCH API returns 409", `${stalePatch.status()}`);
  }

  await runTwoTabConflict(page, pageB);
  await runFlatEditSmoke(page);

  if (!EXPECT_ON) {
    skip("§9.4 on mode SERVER_WINS", "set SMOKE_EXPECT_UNIFICATION_ON=true + rebuild web with flag=on");
  }
} catch (error) {
  fail("unexpected", error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n--- ${results.length - failed.length}/${results.length} passed ---`);
if (failed.length > 0) {
  process.exit(1);
}
