/**
 * Dev probe: OTP session + POST /api/v2/tours for a provisioned workspace slug.
 *
 *   pnpm --filter @apps/api probe:tour-create -- --slug=denali
 *   API_BASE_URL=http://127.0.0.1:3001 pnpm --filter @apps/api probe:tour-create -- --slug=urban-demo
 *
 * Requires API running with dev static OTP (1234) and matching owner phone on the user row.
 */
import { randomUUID } from "node:crypto";

import { DENALI_OWNER_PHONE, DENALI_SUBDOMAIN } from "./denali-tenant.fixture";
import { DataSource } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { WorkspaceDestinationEntity } from "../modules/settings-locations/entities/workspace-destination.entity";
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
  const fromEnv = process.env.API_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  const port = process.env.PORT?.trim() || "3001";
  return `http://${slug}.localhost:${port}`;
}

async function fetchJson(
  url: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const res = await fetch(url, { ...init, headers });
  let body: unknown;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

export async function probeWorkspaceTourCreate(slug: string): Promise<void> {
  const phone = SLUG_OWNER_PHONE[slug];
  if (!phone) {
    throw new Error(
      `probe:tour-create: no owner phone mapped for "${slug}". Add to SLUG_OWNER_PHONE or pass a known QA slug.`,
    );
  }

  const base = workspaceBaseUrl(slug);

  const session = await fetchJson(`${base}/api/v2/auth/web/session/otp`, {
    method: "POST",
    body: JSON.stringify({ phone, otp: DEV_OTP }),
  });
  if (session.status !== 200) {
    throw new Error(
      `OTP session failed (${session.status}): ${JSON.stringify(session.body)}. Is API up at ${base}? AUTH_ALLOW_DEV_STATIC_OTP enabled?`,
    );
  }
  const token = (session.body as { session_token?: string }).session_token;
  if (!token) {
    throw new Error(`OTP response missing session_token: ${JSON.stringify(session.body)}`);
  }

  const title = `Probe ${slug} ${randomUUID().slice(0, 8)} TenChars`;
  const body =
    slug === DENALI_SUBDOMAIN
      ? await buildDenaliProbeCreateBody(title)
      : {
          title,
          total_capacity: 10,
          lifecycle_status: "Draft",
          transportModes: [],
        };

  const tour = await fetchJson(`${base}/api/v2/tours`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(body),
  });

  if (tour.status !== 201) {
    throw new Error(`POST /tours failed (${tour.status}): ${JSON.stringify(tour.body)}`);
  }

  const tourId = (tour.body as { id?: string }).id;
  emitScriptInfo(`✓ ${slug}: created tour id=${tourId} title="${title}"`);
}

async function buildDenaliProbeCreateBody(title: string): Promise<Record<string, unknown>> {
  const ds = new DataSource({
    ...createDataSourceOptionsFromEnv(),
    entities: [WorkspaceDestinationEntity],
  });
  await ds.initialize();
  try {
    const dest = await ds.getRepository(WorkspaceDestinationEntity).findOne({
      where: { isActive: true },
      order: { sortOrder: "ASC" },
    });
    const destinationId = dest?.id;
    if (!destinationId) {
      throw new Error("Denali probe: no active destination — run provision:denali first.");
    }
    return {
      title,
      total_capacity: 12,
      lifecycle_status: "Draft",
      tourType: "mountain",
      destinationId,
      price: 100_000,
      requiresPayment: true,
      formProfile: "denali_pilot",
      transportModes: ["bus"],
      tripDetails: {
        overview: {
          denaliTourKind: "mountain_day",
          shortIntro: "Denali probe tour",
        },
        logistics: {
          departureDate: "2026-09-01",
          departureMeetingTime: "08:00",
          primaryTransportMode: "bus",
          groupSizeMax: 12,
        },
        participation: {
          minimumAge: 18,
          fitnessLevel: "moderate",
          experienceLevel: "basic",
          sportsInsuranceRequired: true,
        },
        policies: {
          cancellationPolicy: "Probe cancellation policy text.",
        },
      },
    };
  } finally {
    await ds.destroy();
  }
}

const slug = resolveTenantSlugFromArgv(process.argv.slice(2));
probeWorkspaceTourCreate(slug).catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
