"use server";

import { buildUrbanPublicTenantHeaders, resolveUrbanApiBaseUrl } from "./urban-api-base";

export type SubmitUrbanRegistrationInput = {
  readonly tenantId: string;
  readonly tourId: string;
  readonly email: string;
  readonly fullName: string;
  readonly phone?: string;
  readonly partySize?: number;
  readonly notes?: string;
};

export type SubmitUrbanRegistrationResult =
  | { readonly ok: true; readonly registrationId: string }
  | { readonly ok: false; readonly status: number; readonly code: string };

export async function submitUrbanRegistrationAction(
  input: SubmitUrbanRegistrationInput
): Promise<SubmitUrbanRegistrationResult> {
  const res = await fetch(`${resolveUrbanApiBaseUrl()}/urban/registrations`, {
    method: "POST",
    headers: {
      ...buildUrbanPublicTenantHeaders(input.tenantId),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      tourId: input.tourId,
      contact: {
        email: input.email,
        fullName: input.fullName,
        ...(input.phone ? { phone: input.phone } : {}),
      },
      ...(input.partySize !== undefined ? { partySize: input.partySize } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    }),
  });

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const code =
      body !== null && typeof body === "object" && "code" in body
        ? String((body as { code?: unknown }).code ?? "unknown_error")
        : "unknown_error";
    return { ok: false, status: res.status, code };
  }

  const registrationId =
    body !== null &&
    typeof body === "object" &&
    "data" in body &&
    (body as { data?: { id?: string } }).data?.id
      ? String((body as { data: { id: string } }).data.id)
      : "";

  return { ok: true, registrationId };
}
