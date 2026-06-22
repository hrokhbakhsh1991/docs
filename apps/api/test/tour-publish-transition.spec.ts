/**
 * P5-B-N-004 — publish lifecycle gates (LC-04..06)
 * @see docs/phase-18/platform-denali-operator-parity.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { DENALI_LIFECYCLE } from "@app-tour/workspace-denali";
import { createCanonicalDocument } from "@app-tour/workspace-sdk";

import {
  assertTourPublishLifecycleOnUpdate,
} from "../src/canonical/assert-tour-publish-lifecycle-gate.ts";
import {
  isTourLifecycleTransitionError,
} from "../src/canonical/assert-tour-lifecycle-transition.ts";

const GOLDEN_FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/workspaces/denali/test/fixtures/golden/tour-publish-ready.json"
);

function denaliCanonicalFromData(data: Record<string, unknown>) {
  return createCanonicalDocument({
    schemaVersion: 1,
    roots: Object.keys(data),
    data,
  });
}

describe("tour-publish-transition (P5-B LC-04..06)", () => {
  it("LC-04 publish PATCH invokes lifecycle transition assert (draft→active)", () => {
    const before = denaliCanonicalFromData({
      publishStatus: "draft",
      basicInfo: { publishStatus: "draft", title: "Alpine day" },
    });
    const after = denaliCanonicalFromData({
      publishStatus: "active",
      basicInfo: { publishStatus: "active", title: "Alpine day" },
    });

    assert.doesNotThrow(() =>
      assertTourPublishLifecycleOnUpdate({
        workspaceType: "denali",
        lifecycle: DENALI_LIFECYCLE,
        before,
        after,
      })
    );
  });

  it("LC-05 rejected unpublish transition throws TourLifecycleTransitionError → HTTP 400", () => {
    const before = denaliCanonicalFromData({
      publishStatus: "active",
      basicInfo: { publishStatus: "active", title: "Alpine day" },
    });
    const after = denaliCanonicalFromData({
      publishStatus: "draft",
      basicInfo: { publishStatus: "draft", title: "Alpine day" },
    });

    assert.throws(
      () =>
        assertTourPublishLifecycleOnUpdate({
          workspaceType: "denali",
          lifecycle: DENALI_LIFECYCLE,
          before,
          after,
        }),
      (error: unknown) => {
        assert.ok(isTourLifecycleTransitionError(error));
        assert.match((error as Error).message, /TOUR_LIFECYCLE_TRANSITION_REJECTED:OPEN->DRAFT/);
        assert.match((error as Error).message, /^TOUR_LIFECYCLE_/);
        return true;
      }
    );
  });

  it("LC-06 golden tour publish-ready draft→active passes on package path", () => {
    const golden = JSON.parse(readFileSync(GOLDEN_FIXTURE, "utf8")) as Record<string, unknown>;
    const before = denaliCanonicalFromData({
      ...golden,
      basicInfo: {
        ...(golden.basicInfo as Record<string, unknown>),
        publishStatus: "draft",
      },
      publishStatus: "draft",
    });
    const after = denaliCanonicalFromData({
      ...golden,
      basicInfo: {
        ...(golden.basicInfo as Record<string, unknown>),
        publishStatus: "active",
      },
      publishStatus: "active",
    });

    assert.doesNotThrow(() =>
      assertTourPublishLifecycleOnUpdate({
        workspaceType: "denali",
        lifecycle: DENALI_LIFECYCLE,
        before,
        after,
      })
    );
  });

  it("LC-04 no publishStatus change is a no-op for lifecycle assert", () => {
    const canonical = denaliCanonicalFromData({
      publishStatus: "draft",
      title: "Unchanged",
    });
    assert.doesNotThrow(() =>
      assertTourPublishLifecycleOnUpdate({
        workspaceType: "denali",
        lifecycle: DENALI_LIFECYCLE,
        before: canonical,
        after: canonical,
      })
    );
  });
});
