/**
 * CW5-09 — compatibility re-export consumer census (CW-1..CW-5).
 * Documents retained paths; retirements require zero-consumer proof.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

type CensusRow = {
  readonly path: string;
  readonly classification:
    | "ACTIVE_CONSUMER_EXISTS"
    | "REEXPORT_ONLY"
    | "ZERO_CONSUMER_SAFE_TO_RETIRE"
    | "EXTERNAL_PUBLIC_API_COMPAT_REQUIRED"
    | "UNCLEAR";
  readonly retired: boolean;
};

const CENSUS: readonly CensusRow[] = [
  {
    path: "packages/workspaces/denali/src/catalog/compute-spots-remaining.ts",
    classification: "ZERO_CONSUMER_SAFE_TO_RETIRE",
    retired: true,
  },
  {
    path: "packages/workspace-sdk/src/http/workspace-registration-guards.ts",
    classification: "EXTERNAL_PUBLIC_API_COMPAT_REQUIRED",
    retired: false,
  },
  {
    path: "packages/workspace-sdk/src/tour/tour-publish-visibility.port.ts",
    classification: "EXTERNAL_PUBLIC_API_COMPAT_REQUIRED",
    retired: false,
  },
  {
    path: "packages/workspace-sdk/src/tour/tour-publish-label-mapping.contract.ts",
    classification: "EXTERNAL_PUBLIC_API_COMPAT_REQUIRED",
    retired: false,
  },
  {
    path: "packages/workspace-sdk/src/http/detect-workspace-tour-publish-transition.ts",
    classification: "EXTERNAL_PUBLIC_API_COMPAT_REQUIRED",
    retired: false,
  },
  {
    path: "packages/workspace-sdk/src/registration/registration-model-divergence.contract.ts",
    classification: "EXTERNAL_PUBLIC_API_COMPAT_REQUIRED",
    retired: false,
  },
  {
    path: "apps/api/src/registrations/registration-published-tour-visibility-compat.ts",
    classification: "ACTIVE_CONSUMER_EXISTS",
    retired: false,
  },
  {
    path: "apps/api/src/canonical/publish-lifecycle-label-compat.ts",
    classification: "ACTIVE_CONSUMER_EXISTS",
    retired: false,
  },
  {
    path: "apps/api/src/registrations/registration-capacity.service.ts",
    classification: "ACTIVE_CONSUMER_EXISTS",
    retired: false,
  },
  {
    path: "apps/api/src/canonical/tour-publish-transition-audit.ts",
    classification: "REEXPORT_ONLY",
    retired: false,
  },
];

describe("CW5-09 compatibility census", () => {
  it("CW5-09-01 retired compat file deleted", () => {
    for (const row of CENSUS.filter((r) => r.retired)) {
      assert.equal(fs.existsSync(path.join(REPO_ROOT, row.path)), false, row.path);
    }
  });

  it("CW5-09-02 retained compat paths still exist on disk", () => {
    for (const row of CENSUS.filter((r) => !r.retired)) {
      assert.equal(fs.existsSync(path.join(REPO_ROOT, row.path)), true, row.path);
    }
  });

  it("CW5-09-03 census classifications are documented", () => {
    assert.equal(CENSUS.length, 10);
    const retired = CENSUS.filter((r) => r.retired);
    assert.deepEqual(retired.map((r) => r.path), [
      "packages/workspaces/denali/src/catalog/compute-spots-remaining.ts",
    ]);
  });
});
