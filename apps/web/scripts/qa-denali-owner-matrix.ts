/**
 * Owner-style matrix: create 6 Denali tours via API (OTP + mapper pipeline).
 *
 * ```bash
 * # API on :3001 with AUTH_ALLOW_DEV_STATIC_OTP=true
 * node --env-file=.env.local --import tsx scripts/qa-denali-owner-matrix.ts
 * ```
 */
import type { DenaliTourKind } from "@repo/types";
import { denaliTourKindToIsMultiDay, isDenaliEventTourKind } from "@repo/types";

import { mapCreateTourDto } from "@/features/tours";
import {
  buildDenaliTourCreateDefaultValues,
} from "@/features/tours";
import { assertSubmitValidDenaliWizardForm } from "@/features/tours/testing/denaliSubmitTestHelpers";
import { mapDenaliWizardToCreateTourPayload } from "@/features/tours";
import { buildCreateTourPostBody } from "@/lib/services/tours.service";

const API_PORT = process.env.API_PORT?.trim() || process.env.PORT?.trim() || "3001";
const API_ORIGIN = (
  process.env.API_ORIGIN ?? `http://denali.localhost:${API_PORT}`
).replace(/\/$/, "");
const OWNER_PHONE = process.env.DENALI_OWNER_PHONE ?? "+989121000001";
const OTP = process.env.DENALI_DEV_OTP ?? "1234";

type ThemeRow = { id: string; slug: string; name: string; formProfile: string };
type DestinationRow = { id: string; name: string };

const MATRIX: ReadonlyArray<{
  kind: DenaliTourKind;
  labelFa: string;
  themeSlug: string;
  meetingPoint?: string;
}> = [
  { kind: "mountain_day", labelFa: "کوه یک‌روزه", themeSlug: "denali-mountain-1-day", meetingPoint: "پارکینگ ورودی مسیر" },
  { kind: "mountain_multi", labelFa: "کوه چندروزه", themeSlug: "denali-mountain-multi-day", meetingPoint: "پناهگاه پایین‌دست" },
  { kind: "nature_day", labelFa: "طبیعت یک‌روزه", themeSlug: "denali-nature-1-day", meetingPoint: "دهکده میزبان" },
  { kind: "nature_multi", labelFa: "طبیعت چندروزه", themeSlug: "denali-nature-multi-day", meetingPoint: "کمپ شب اول" },
  {
    kind: "event_reading",
    labelFa: "جلسه کتاب‌خوانی",
    themeSlug: "denali-short-session-1h",
    meetingPoint: "کافه کتابخانه — میز اصلی",
  },
  {
    kind: "event_cinema",
    labelFa: "جلسه فیلم در کافه",
    themeSlug: "denali-short-session-2h",
    meetingPoint: "کافه فیلم — سالن کوچک",
  },
];

function apiHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.url} → ${res.status}: ${text.slice(0, 600)}`);
  }
  return JSON.parse(text) as T;
}

async function login(): Promise<string> {
  const res = await fetch(`${API_ORIGIN}/api/v2/auth/web/session/otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: OWNER_PHONE, otp: OTP }),
  });
  const body = await readJson<{ session_token: string }>(res);
  return body.session_token;
}

async function fetchDestination(token: string): Promise<string> {
  const destRes = await fetch(`${API_ORIGIN}/api/v2/settings/destinations`, {
    headers: apiHeaders(token),
  });
  const dests = await readJson<DestinationRow[]>(destRes);
  const id = dests[0]?.id;
  if (!id) {
    throw new Error("No workspace destinations — run provision:denali");
  }
  return id;
}

async function fetchThemeBySlug(token: string, slug: string): Promise<string> {
  const res = await fetch(`${API_ORIGIN}/api/v2/settings/tour-themes`, {
    headers: apiHeaders(token),
  });
  const themes = await readJson<ThemeRow[]>(res);
  const row = themes.find((t) => t.slug === slug);
  if (!row?.id) {
    throw new Error(`Theme slug "${slug}" not found — run provision:denali`);
  }
  return row.id;
}

function buildFormForKind(
  kind: DenaliTourKind,
  destinationId: string,
  themeId: string,
  runId: string,
  meetingPoint?: string,
) {
  const base = buildDenaliTourCreateDefaultValues();
  const isMulti = denaliTourKindToIsMultiDay(kind);
  const isEvent = isDenaliEventTourKind(kind);

  const title = `1234567890 تست دنالی ${MATRIX.find((m) => m.kind === kind)?.labelFa ?? kind} ${runId}`;

  return assertSubmitValidDenaliWizardForm({
    ...base,
    basicInfo: {
      ...base.basicInfo,
      title,
      tourType: kind,
      destinationId,
      startDateTime: "2026-09-15T08:00:00.000Z",
      endDateTime: isMulti ? "2026-09-17T18:00:00.000Z" : undefined,
      capacityMax: 16,
      meetingPoint: meetingPoint ?? "محل تجمع تست مالک",
    },
    programNature: {
      ...base.programNature,
      themeIds: [themeId],
      shortDescription: `تور تست ${kind} — ${runId}`,
      longDescription: isEvent
        ? "رویداد فرهنگی تست مالک دنالی."
        : "برنامه تست مالک دنالی با مسیر و زمان‌بندی نمونه.",
      difficultyLevel: isEvent ? 5 : 5,
      hikingHoursApprox: isEvent ? undefined : 4,
    },
    participantRequirements: {
      ...base.participantRequirements,
      minimumAge: kind.startsWith("mountain_") ? 18 : undefined,
      fitnessLevel: kind.startsWith("mountain_") ? "medium" : undefined,
      sportsInsuranceRequired: kind.startsWith("mountain_") ? true : undefined,
    },
    policies: {
      policiesText: "سیاست لغو تست مالک دنالی.",
    },
  });
}

async function createTour(token: string, kind: DenaliTourKind, themeId: string, destinationId: string, runId: string, meetingPoint?: string) {
  const form = buildFormForKind(kind, destinationId, themeId, runId, meetingPoint);
  const clientDto = mapDenaliWizardToCreateTourPayload(form);
  const prepared = mapCreateTourDto(clientDto, { themeCatalog: [] });
  const wire = buildCreateTourPostBody(prepared);

  const res = await fetch(`${API_ORIGIN}/api/v2/tours`, {
    method: "POST",
    headers: {
      ...apiHeaders(token),
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(wire),
  });
  const created = await readJson<{ id: string; title: string; formProfileSnapshot?: string }>(res);
  const overview = (wire.tripDetails as { overview?: { denaliTourKind?: string } } | undefined)?.overview;
  return {
    id: created.id,
    title: created.title,
    formProfileSnapshot: created.formProfileSnapshot,
    denaliTourKind: overview?.denaliTourKind,
  };
}

async function main(): Promise<void> {
  const runId = String(Date.now());

  const token = await login();
  const destinationId = await fetchDestination(token);

  const results: Array<{ kind: DenaliTourKind; ok: boolean; detail: string }> = [];

  for (const row of MATRIX) {
    try {
      const themeId = await fetchThemeBySlug(token, row.themeSlug);
      const created = await createTour(token, row.kind, themeId, destinationId, runId, row.meetingPoint);
      const ok =
        created.formProfileSnapshot === "denali_pilot" && created.denaliTourKind === row.kind;
      results.push({
        kind: row.kind,
        ok,
        detail: ok
          ? `201 id=${created.id} title=${created.title}`
          : `201 but snapshot/kind mismatch: profile=${created.formProfileSnapshot} kind=${created.denaliTourKind}`,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.push({ kind: row.kind, ok: false, detail: msg });
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  } else {
  }
}

main().catch((_e: unknown) => {
  process.exitCode = 1;
});
