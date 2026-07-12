import "@app-tour/workspace-plugin-host/intake-register";

import { NextResponse } from "next/server";

import {
  buildCatalogRegistrationUpstreamRequest,
  CatalogRegistrationPayloadInvalidError,
  IntakePluginNotRegisteredError,
} from "@app-tour/workspace-sdk";

import { buildCatalogRegistrationHeaders } from "@/catalog/build-catalog-registration-headers.server";
import { resolveTourOpsApiBaseUrl } from "@/env";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

type RegistrationBody = {
  readonly tourId?: unknown;
  readonly email?: unknown;
  readonly fullName?: unknown;
  readonly phone?: unknown;
  readonly partySize?: unknown;
  readonly notes?: unknown;
  readonly nationalId?: unknown;
  readonly fatherName?: unknown;
  readonly birthDate?: unknown;
  readonly registrantTarget?: unknown;
  readonly transport?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const body = (await req.json().catch(() => ({}))) as RegistrationBody;

  const tourId = typeof body.tourId === "string" ? body.tourId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const nationalId = typeof body.nationalId === "string" ? body.nationalId.trim() : "";
  const fatherName = typeof body.fatherName === "string" ? body.fatherName.trim() : "";
  const birthDate = typeof body.birthDate === "string" ? body.birthDate.trim() : "";
  const registrantTarget =
    body.registrantTarget === "other" ? "other" : body.registrantTarget === "self" ? "self" : undefined;
  const partySize =
    typeof body.partySize === "number"
      ? body.partySize
      : Number.parseInt(String(body.partySize ?? ""), 10);

  if (tourId.length === 0 || fullName.length === 0) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD" }, { status: 400 });
  }
  if (!Number.isFinite(partySize) || partySize < 1) {
    return NextResponse.json({ ok: false, code: "PARTY_SIZE_INVALID" }, { status: 400 });
  }

  let upstream;
  try {
    upstream = buildCatalogRegistrationUpstreamRequest(
      bootstrap.pluginId,
      {
        tourId,
        fullName,
        email,
        phone,
        partySize,
        notes,
        nationalId,
        fatherName,
        birthDate,
        registrantTarget,
        transport: body.transport,
      },
      {
        idempotencyKey:
          req.headers.get("idempotency-key")?.trim() ??
          req.headers.get("Idempotency-Key")?.trim(),
      }
    );
  } catch (error) {
    if (error instanceof CatalogRegistrationPayloadInvalidError) {
      return NextResponse.json({ ok: false, code: error.code }, { status: 400 });
    }
    if (error instanceof IntakePluginNotRegisteredError) {
      return NextResponse.json({ ok: false, code: error.code }, { status: 503 });
    }
    console.error("[portal/catalog/registrations] buildCatalogRegistrationUpstreamRequest failed", error);
    return NextResponse.json(
      { ok: false, code: "REGISTRATION_UPSTREAM_BUILD_FAILED" },
      { status: 500 }
    );
  }

  const apiBase = resolveTourOpsApiBaseUrl();
  const headers = {
    ...(await buildCatalogRegistrationHeaders(bootstrap.tenantId)),
    "content-type": "application/json",
    ...(upstream.extraHeaders ?? {}),
  };

  const res = await fetch(`${apiBase}${upstream.path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(upstream.body),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    code?: string;
    data?: { id?: string };
  };
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: typeof payload.code === "string" ? payload.code : "unknown_error" },
      { status: res.status }
    );
  }
  return NextResponse.json(
    { ok: true, registrationId: payload.data?.id ?? null },
    { status: 201 }
  );
}
