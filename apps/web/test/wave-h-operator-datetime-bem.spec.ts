import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const REPO = join(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const WEB = join(REPO, "apps/web");
const DENALI = join(REPO, "packages/workspaces/denali");

const FORBIDDEN = [
  "denali-wizard-datetime",
  "denali-date-picker",
  "isDenaliOperatorSession",
] as const;

const REQUIRED = [
  "operator-wizard-datetime",
  "operator-date-picker",
  "isExtendedOperatorSession",
] as const;

const SURFACES = [
  join(DENALI, "src/ui/components/localized-date-picker.tsx"),
  join(DENALI, "src/ui/components/localized-datetime-picker.tsx"),
  join(DENALI, "theme/wizard-calendar.css"),
  join(DENALI, "theme/wizard-fields.css"),
  join(WEB, "src/admin/require-operator-session.ts"),
  join(WEB, "tests/e2e/custom-create-tours.spec.ts"),
  join(WEB, "scripts/denali-create-mountain-day-tour.mjs"),
] as const;

describe("Wave H.p — operator datetime/date-picker BEM", () => {
  it("datetime/date BEM and session helper drop Denali brands", () => {
    const corpus = SURFACES.map((p) => readFileSync(p, "utf8")).join("\n");
    for (const token of FORBIDDEN) {
      assert.equal(corpus.includes(token), false, `forbidden leftover: ${token}`);
    }
    for (const token of REQUIRED) {
      assert.match(corpus, new RegExp(token));
    }
  });
});
