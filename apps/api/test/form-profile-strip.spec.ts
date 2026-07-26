/**
 * P5-B-N-007 — form profile strip before persist (VAL-02b)
 * @see docs/phase-18/platform-denali-operator-parity.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { createCanonicalDocument } from "@app-tour/workspace-sdk";

import { resolveWorkspacePluginForType } from "../src/workspace/resolve-workspace-plugin.ts";
import {
  filterRootsAfterProfileStrip,
  stripFormProfileFieldsFromCanonicalData,
  stripFormProfileForSubmit,
} from "../src/canonical/strip-form-profile-for-submit.ts";
import {
  resetValidationEngineCacheForTests,
} from "../src/tours/canonical-validation-sync.ts";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("form-profile-strip (P5-B VAL-02b)", () => {
  beforeEach(() => {
    process.env.P5_VALIDATION_WORKERS_ENABLED = "false";
    resetValidationEngineCacheForTests();
  });

  afterEach(() => {
    delete process.env.P5_VALIDATION_WORKERS_ENABLED;
    resetValidationEngineCacheForTests();
  });

  it("VAL-02b-01 strips top-level tour-kind alias ghosts on denali submit data", async () => {
    const stripped = stripFormProfileFieldsFromCanonicalData("denali", {
      category: "mountain_day",
      duration: "single_day",
      eventVariant: "standard",
      title: "Alpine day",
      pricing: {
        requiresPayment: true,
        basePricePerPerson: 500000,
      },
      program: {
        themeIds: ["theme-1"],
        shortDescription: "خلاصه",
      },
    });

    assert.equal(stripped.category, "mountain_day");
    assert.equal(stripped.title, "Alpine day");
    assert.equal(stripped.duration, undefined);
    assert.equal(stripped.eventVariant, undefined);
    assert.equal((stripped.pricing as Record<string, unknown>).basePricePerPerson, 500000);
    assert.equal((stripped.program as Record<string, unknown>).shortDescription, "خلاصه");
  });

  it("VAL-02b-02 non-denali workspace is a no-op", async () => {
    const input = {
      duration: "single_day",
      basics: { title: "Starter tour" },
    };
    assert.equal(stripFormProfileFieldsFromCanonicalData("starter", input), input);
  });

  it("VAL-02b-03 stripFormProfileForSubmit rebuilds canonical document data", async () => {
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["category", "duration", "title"],
      data: {
        category: "nature_day",
        duration: "multi_day",
        title: "Forest walk",
      },
    });

    const stripped = stripFormProfileForSubmit("denali", document);
    assert.equal(stripped.data.category, "nature_day");
    assert.equal(stripped.data.duration, undefined);
    assert.equal(stripped.data.title, "Forest walk");
  });

  it("VAL-02b-04 plugin ingress roots drop composite-dependent ghosts after strip", async () => {
    const plugin = await resolveWorkspacePluginForType("denali");
    const raw = {
      category: "mountain_day",
      duration: "single_day",
      eventVariant: "standard",
      title: "Ghost purge",
      publishStatus: "draft",
    };
    const stripped = stripFormProfileFieldsFromCanonicalData("denali", raw);
    const roots = filterRootsAfterProfileStrip("denali", plugin.wizard.roots, stripped);

    assert.equal(stripped.duration, undefined);
    assert.equal(stripped.eventVariant, undefined);
    assert.ok(!roots.includes("duration"));
    assert.ok(roots.includes("category"));
  });

  it("VAL-02b-05 canonical-validation-sync imports strip helper", async () => {
    const source = readFileSync(
      join(apiRoot, "src/tours/canonical-validation-sync.ts"),
      "utf8"
    );
    assert.match(source, /stripFormProfileFieldsFromCanonicalData/);
    assert.match(source, /filterRootsAfterProfileStrip/);
  });
});
