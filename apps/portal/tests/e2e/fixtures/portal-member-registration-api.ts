import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

type MemberRegistrationListItem = {
  readonly id?: string;
  readonly tourTitle?: string;
  readonly status?: string;
};

export async function fetchMemberRegistrationId(
  page: Page,
  input?: { readonly tourTitle?: string },
): Promise<string> {
  const res = await page.request.get("/api/me/registrations");
  const bodyText = await res.text();
  expect(res.ok(), bodyText).toBeTruthy();
  const body = JSON.parse(bodyText) as {
    data?: { items?: readonly MemberRegistrationListItem[] };
  };
  const items = body.data?.items ?? [];
  expect(items.length, "member must have at least one registration").toBeGreaterThan(0);

  if (input?.tourTitle) {
    const match = items.find((item) => item.tourTitle === input.tourTitle);
    expect(match?.id, `registration for tour "${input.tourTitle}"`).toBeTruthy();
    return match!.id!;
  }

  const latest = items[0];
  expect(latest?.id, "latest registration id").toBeTruthy();
  return latest!.id!;
}

/** Minimal 1×1 PNG for member receipt upload smoke. */
export function minimalReceiptPngBuffer(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}
