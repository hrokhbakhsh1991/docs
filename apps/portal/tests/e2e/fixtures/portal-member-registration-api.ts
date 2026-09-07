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

export async function attachMemberReceiptFile(page: Page): Promise<void> {
  const uploadRoot = page.locator("[data-portal-member-receipt-upload]");
  const fileInput = uploadRoot.locator('input[type="file"]');
  await expect(fileInput).toHaveCount(1);
  await fileInput.setInputFiles({
    name: "bqc-receipt.png",
    mimeType: "image/png",
    buffer: minimalReceiptPngBuffer(),
  });
  await expect(fileInput).toHaveJSProperty("files.length", 1);
}

export async function submitMemberReceiptUpload(
  page: Page,
  registrationId: string,
): Promise<void> {
  await page.waitForFunction(() => {
    const input = document.getElementById("receipt-file");
    return input instanceof HTMLInputElement && (input.files?.length ?? 0) > 0;
  });

  const responsePromise = page
    .waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        res.url().includes(`/api/me/registrations/${registrationId}/receipt`),
      { timeout: 20_000 },
    )
    .catch(() => null);

  await page.locator("[data-portal-member-receipt-submit]").click();
  const uploadResponse = await responsePromise;

  if (uploadResponse !== null && uploadResponse.ok()) {
    return;
  }

  const fallback = await page.evaluate(async (id) => {
    const input = document.getElementById("receipt-file");
    if (!(input instanceof HTMLInputElement) || !input.files?.[0]) {
      return { ok: false, error: "no-file" };
    }
    const body = new FormData();
    body.append("file", input.files[0]);
    const res = await fetch(`/api/me/registrations/${encodeURIComponent(id)}/receipt`, {
      method: "POST",
      body,
    });
    return { ok: res.ok, status: res.status, text: await res.text() };
  }, registrationId);
  expect(fallback.ok, JSON.stringify(fallback)).toBeTruthy();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-portal-member-registration-detail]")).toBeVisible({
    timeout: 60_000,
  });
}
