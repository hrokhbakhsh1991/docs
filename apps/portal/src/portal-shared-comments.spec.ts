import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SHARED_PORTAL_FILES = [
  "../app/api/me/registrations/[id]/route.ts",
  "../app/login/page.tsx",
  "catalog/catalog-registration-stepper.tsx",
  "catalog/portal-auth-experience-shell.tsx",
  "i18n/app-fonts.google.ts",
  "me/fetch-member-self-registration-for-tour.server.ts",
  "shell/portal-member-header.tsx",
] as const;

describe("portal shared surfaces", () => {
  it("keeps shared portal comments workspace-generic", () => {
    for (const file of SHARED_PORTAL_FILES) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), {
        encoding: "utf8",
      });
      assert.doesNotMatch(source, /Shared Denali auth shell/);
      assert.doesNotMatch(source, /Denali catalog registration steps/);
      assert.doesNotMatch(source, /signed-in member \(Denali\)/);
      assert.doesNotMatch(source, /Denali Pocket/);
      assert.doesNotMatch(source, /denali plugin \+ tenant/);
      assert.doesNotMatch(source, /denali\.club login tour/);
      assert.doesNotMatch(source, /Denali owned GET/);
      assert.doesNotMatch(source, /Denali Club display headings/);
    }
  });
});
