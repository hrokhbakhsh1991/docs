/**
 * Smoke: Denali presets in API use 6-tab JSON; mapper produces filled form.
 *
 * ```bash
 * node --env-file=../api/.env --import tsx scripts/qa-denali-preset-wire.ts
 * ```
 */
import { presetDefaultsToDenaliFormPatch } from "@/features/tours";

const API_ORIGIN = (process.env.API_ORIGIN ?? "http://denali.localhost:3001").replace(/\/$/, "");
const PHONE = process.env.DENALI_OWNER_PHONE ?? "+989121000001";
const OTP = process.env.DENALI_DEV_OTP ?? "1234";

async function login(): Promise<string> {
  const res = await fetch(`${API_ORIGIN}/api/v2/auth/web/session/otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: PHONE, otp: OTP }),
  });
  if (!res.ok) throw new Error(`login ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { session_token: string };
  return body.session_token;
}

async function main(): Promise<void> {
  const token = await login();
  const res = await fetch(`${API_ORIGIN}/api/v2/settings/tour-presets`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`presets ${res.status}`);
  const presets = (await res.json()) as Array<{
    id: string;
    name: string;
    formProfile: string;
    defaults: Record<string, unknown>;
    matchTourType: string | null;
    matchMainTourThemeId: string | null;
  }>;

  const denali = presets.filter((p) => p.name.startsWith("دنالی —"));
  if (denali.length < 6) {
    throw new Error(`expected ≥6 Denali presets, got ${denali.length}`);
  }

  let ok = 0;
  for (const p of denali) {
    const roots = Object.keys(p.defaults ?? {});
    const hasSixTab = roots.includes("basicInfo") && roots.includes("programNature");
    const patch = presetDefaultsToDenaliFormPatch(p.defaults ?? {}, {
      matchTourType: p.matchTourType,
      matchMainTourThemeId: p.matchMainTourThemeId,
    });
    const kind = patch.basicInfo?.tourType;
    const short = patch.programNature?.shortDescription;
    if (!hasSixTab || !kind || !short) {
      process.exitCode = 1;
      continue;
    }
    ok += 1;
  }
  if (ok !== denali.length) process.exitCode = 1;
}

main().catch((_e: unknown) => {
  process.exitCode = 1;
});
