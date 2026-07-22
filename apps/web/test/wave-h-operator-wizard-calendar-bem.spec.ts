import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const REPO = join(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const DENALI = join(REPO, "packages/workspaces/denali");

const SURFACES = [
  join(DENALI, "src/ui/components/calendar/denali-calendar.tsx"),
  join(DENALI, "theme/wizard-calendar.css"),
] as const;

describe("Wave H.q — operator wizard-calendar BEM", () => {
  it("calendar grid BEM and CSS vars use operator-wizard-calendar*", () => {
    const corpus = SURFACES.map((p) => readFileSync(p, "utf8")).join("\n");
    assert.equal(corpus.includes("denali-wizard-calendar"), false);
    assert.match(corpus, /operator-wizard-calendar__/);
    assert.match(corpus, /--operator-wizard-calendar-primary/);
    assert.match(corpus, /data-operator-wizard-calendar/);
  });
});
