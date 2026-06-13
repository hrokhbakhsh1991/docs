import { NextResponse } from "next/server";

import { buildCatalogRegistrationHeaders } from "@/catalog/build-catalog-registration-headers.server";
import { resolveTourOpsApiBaseUrl } from "@/env";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { buildUrbanIntakeIdempotencyKey } from "@/urban/build-urban-intake-idempotency-key";

type RegistrationBody = {
  readonly tourId?: unknown;
  readonly email?: unknown;
  readonly fullName?: unknown;
  readonly phone?: unknown;
  readonly partySize?: unknown;
  readonly notes?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const host = req.headers.get("host") ?? "localhost:3003";
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const body = (await req.json().catch(() => ({}))) as RegistrationBody;

  const tourId = typeof body.tourId === "string" ? body.tourId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const partySize =
    typeof body.partySize === "number"
      ? body.partySize
      : Number.parseInt(String(body.partySize ?? ""), 10);

  if (tourId.length === 0 || email.length === 0 || fullName.length === 0) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD" }, { status: 400 });
  }
  if (!Number.isFinite(partySize) || partySize < 1) {
    return NextResponse.json({ ok: false, code: "PARTY_SIZE_INVALID" }, { status: 400 });
  }

  const apiBase = resolveTourOpsApiBaseUrl();
  const headers = {
    ...(await buildCatalogRegistrationHeaders(bootstrap.tenantId)),
    "content-type": "application/json",
  };

  if (bootstrap.pluginId === "denali") {
    const res = await fetch(`${apiBase}/denali/registrations`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        tourId,
        contact: {
          email,
          fullName,
          ...(phone.length > 0 ? { phone } : {}),
        },
        partySize,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as { code?: string; data?: { id?: string } };
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, code: typeof payload.code === "string" ? payload.code : "unknown_error" },
        { status: res.status }
      );
    }
    return NextResponse.json({ ok: true, registrationId: payload.data?.id ?? null }, { status: 201 });
  }

  if (bootstrap.pluginId === "urban") {
    const catalogHeaders = await buildCatalogRegistrationHeaders(bootstrap.tenantId);
    const actorUserId = catalogHeaders["x-user-id"] ?? "anonymous";
    const idempotencyKey = buildUrbanIntakeIdempotencyKey({
      tenantId: bootstrap.tenantId,
      tourId,
      email,
      actorUserId,
    });
    const res = await fetch(`${apiBase}/urban/registrations`, {
      method: "POST",
      headers: {
        ...catalogHeaders,
        "content-type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        tourId,
        contact: {
          email,
          fullName,
          ...(phone.length > 0 ? { phone } : {}),
        },
        partySize,
        ...(notes.length > 0 ? { notes } : {}),
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as { code?: string; data?: { id?: string } };
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, code: typeof payload.code === "string" ? payload.code : "unknown_error" },
        { status: res.status }
      );
    }
    return NextResponse.json({ ok: true, registrationId: payload.data?.id ?? null }, { status: 201 });
  }

  return NextResponse.json({ ok: false, code: "REGISTRATION_CLOSED" }, { status: 404 });
}
