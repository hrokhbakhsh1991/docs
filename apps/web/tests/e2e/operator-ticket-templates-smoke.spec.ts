/**
 * TKT-J1 — operator ticket template API smoke (Postgres-backed API).
 */
import { expect, test } from "@playwright/test";

import { SESSION_TOKEN_COOKIE } from "../../src/auth/build-session-cookie";
import {
  loginOperatorOwner,
  loginOperatorViewer,
} from "../../test/fixtures/operator-owner-session";

function tourOpsApiBase(): string {
  return (process.env.TOUR_OPS_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
}

async function readSessionBearer(page: import("@playwright/test").Page): Promise<string> {
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === SESSION_TOKEN_COOKIE);
  expect(session?.value, "operator session cookie missing").toBeTruthy();
  return session!.value;
}

async function apiRequest(
  page: import("@playwright/test").Page,
  input: {
    readonly method: "GET" | "POST" | "PATCH";
    readonly path: string;
    readonly body?: Record<string, unknown>;
  },
): Promise<import("@playwright/test").APIResponse> {
  const bearer = await readSessionBearer(page);
  return page.request.fetch(`${tourOpsApiBase()}${input.path}`, {
    method: input.method,
    headers: {
      Authorization: `Bearer ${bearer}`,
      "content-type": "application/json",
    },
    ...(input.body === undefined ? {} : { data: input.body }),
  });
}

test.describe("TKT-J1 operator ticket templates API", () => {
  test("owner lists Denali defaults; viewer read-only; preview interpolates", async ({ page }) => {
    await loginOperatorOwner(page);

    const listRes = await apiRequest(page, { method: "GET", path: "/ticket-templates" });
    expect(listRes.ok(), await listRes.text()).toBeTruthy();
    const listBody = (await listRes.json()) as { items?: Array<{ code: string; locale: string }> };
    expect(Array.isArray(listBody.items)).toBeTruthy();
    expect(listBody.items?.some((item) => item.code === "reply_ack" && item.locale === "en")).toBeTruthy();
    expect(listBody.items?.some((item) => item.code === "reply_ack" && item.locale === "fa")).toBeTruthy();

    const previewRes = await apiRequest(page, {
      method: "POST",
      path: "/ticket-templates/reply_ack/preview?channel=public_reply&locale=en",
      body: {
        ticketSubject: "Smoke subject",
        ticketId: "00000000-0000-4000-8000-000000000001",
        status: "open",
      },
    });
    expect(previewRes.ok(), await previewRes.text()).toBeTruthy();
    const previewBody = (await previewRes.json()) as { rendered?: string };
    expect(previewBody.rendered).toContain("Smoke subject");

    await loginOperatorViewer(page);
    const viewerList = await apiRequest(page, { method: "GET", path: "/ticket-templates" });
    expect(viewerList.ok(), await viewerList.text()).toBeTruthy();

    const viewerCreate = await apiRequest(page, {
      method: "POST",
      path: "/ticket-templates/playwright_denied",
      body: {
        title: "Denied",
        body: "nope",
        channel: "public_reply",
        locale: "en",
      },
    });
    expect(viewerCreate.status()).toBe(403);
  });
});
