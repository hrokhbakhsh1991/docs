/**
 * Dev probe: OTP session + PATCH/GET tour wizard server draft.
 *
 *   pnpm --filter @apps/api probe:tour-draft -- --slug=denali
 */
import { randomUUID } from "node:crypto";

import { DENALI_OWNER_PHONE, DENALI_SUBDOMAIN } from "./denali-tenant.fixture";
import { emitScriptInfo } from "./script-log";
import { MIX_DEMO_OWNER_PHONE, MIX_DEMO_SUBDOMAIN } from "./mix-demo-tenant.fixture";
import { URBAN_DEMO_OWNER_PHONE, URBAN_DEMO_SUBDOMAIN } from "./urban-demo-tenant.fixture";
import { resolveTenantSlugFromArgv } from "./verify-workspace-tenant";

const DEV_OTP = "1234";

const SLUG_OWNER_PHONE: Record<string, string> = {
  [DENALI_SUBDOMAIN]: DENALI_OWNER_PHONE,
  [URBAN_DEMO_SUBDOMAIN]: URBAN_DEMO_OWNER_PHONE,
  [MIX_DEMO_SUBDOMAIN]: MIX_DEMO_OWNER_PHONE,
};

function workspaceBaseUrl(slug: string): string {
  const port = process.env.PORT?.trim() || "3001";
  return (process.env.API_BASE_URL ?? `http://${slug}.localhost:${port}`).replace(/\/$/, "");
}

async function fetchJson(
  url: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

export async function probeWorkspaceTourDraft(slug: string): Promise<void> {
  const phone = SLUG_OWNER_PHONE[slug];
  if (!phone) {
    throw new Error(`probe:tour-draft: no owner phone for "${slug}"`);
  }
  const base = workspaceBaseUrl(slug);

  const session = await fetchJson(`${base}/api/v2/auth/web/session/otp`, {
    method: "POST",
    body: JSON.stringify({ phone, otp: DEV_OTP }),
  });
  if (session.status !== 200) {
    throw new Error(`OTP failed (${session.status}): ${JSON.stringify(session.body)}`);
  }
  const token = (session.body as { session_token?: string }).session_token;
  if (!token) {
    throw new Error("missing session_token");
  }

  const title = `Draft probe ${slug} ${randomUUID().slice(0, 6)}`;
  const envelope = {
    overview: { title, tourType: "city" },
    _wizardMeta: { resolvedFormProfile: "urban_event", formProfileVersion: 1 },
  };

  await fetchJson(`${base}/api/v2/settings/tour-wizard-draft`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  const patch = await fetchJson(`${base}/api/v2/settings/tour-wizard-draft`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ envelope }),
  });
  if (patch.status !== 200) {
    throw new Error(`PATCH draft failed (${patch.status}): ${JSON.stringify(patch.body)}`);
  }

  type DraftBody = { draft?: { envelope?: { overview?: { title?: string } } } };
  const patchDraft = (patch.body as DraftBody).draft;
  const patchTitle = patchDraft?.envelope?.overview?.title;
  if (patchTitle !== title) {
    throw new Error(
      `PATCH draft title mismatch: expected "${title}", got "${String(patchTitle)}"`,
    );
  }

  let gotTitle: string | undefined;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const get = await fetchJson(`${base}/api/v2/settings/tour-wizard-draft`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (get.status !== 200) {
      throw new Error(`GET draft failed (${get.status}): ${JSON.stringify(get.body)}`);
    }
    gotTitle = (get.body as DraftBody).draft?.envelope?.overview?.title;
    if (gotTitle === title) {
      break;
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  if (gotTitle !== title) {
    throw new Error(`GET round-trip title mismatch: expected "${title}", got "${String(gotTitle)}"`);
  }
  emitScriptInfo(`✓ ${slug}: server draft round-trip ok title="${title}"`);
}

const slug = resolveTenantSlugFromArgv(process.argv.slice(2));
probeWorkspaceTourDraft(slug).catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
