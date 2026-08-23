/**
 * CW3-06 — publish lifecycle gate manifest mapping migration parity.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_LIFECYCLE } from "@app-tour/workspace-denali";
import { URBAN_LIFECYCLE } from "@app-tour/workspace-urban";
import { createCanonicalDocument } from "@app-tour/workspace-sdk";

import {
  assertTourPublishLifecycleOnUpdate,
} from "../src/canonical/assert-tour-publish-lifecycle-gate.ts";
import {
  resolveLifecycleStatusFromLabelCompatHeuristic,
} from "../src/canonical/publish-lifecycle-label-compat.ts";
import { readTourPublishStatusLabel } from "../src/canonical/workspace-canonical-tour-dispatch.ts";
import { resolveTourPublishLifecycleStatusFromLabel } from "../src/canonical/workspace-publish-label-mapping-dispatch.ts";

function denaliCanonical(publishStatus: string) {
  return createCanonicalDocument({
    schemaVersion: 1,
    roots: ["publishStatus", "basicInfo"],
    data: {
      publishStatus,
      basicInfo: { publishStatus, title: "Alpine day" },
    },
  });
}

function urbanCanonical(publishStatus: string) {
  return createCanonicalDocument({
    schemaVersion: 1,
    roots: ["tour"],
    data: {
      tour: { title: "Urban walk", publishStatus },
    },
  });
}

const HARBOR_LIFECYCLE = {
  initialStatus: "DRAFT",
  publishStatus: "PUBLISHED",
  allowedTransitions: [{ from: "DRAFT", to: "PUBLISHED" }],
};

function harborCanonical(status: string) {
  return createCanonicalDocument({
    schemaVersion: 1,
    roots: ["status", "title"],
    data: { status, title: "Harbor walk" },
  });
}

function resolveViaMapping(workspaceType: string, lifecycle: typeof DENALI_LIFECYCLE, canonical: ReturnType<typeof denaliCanonical>) {
  const label = readTourPublishStatusLabel(workspaceType, canonical);
  const mapped = resolveTourPublishLifecycleStatusFromLabel({
    workspaceType,
    lifecycle,
    label,
  });
  if (mapped !== undefined) {
    return mapped;
  }
  return resolveLifecycleStatusFromLabelCompatHeuristic({ lifecycle, label });
}

describe("CW3-06 publish lifecycle gate mapping migration", () => {
  it("CW3-06-01 mapping parity matches compat heuristic for denali active/draft", () => {
    const active = denaliCanonical("active");
    const draft = denaliCanonical("draft");
    assert.equal(
      resolveViaMapping("denali", DENALI_LIFECYCLE, active),
      resolveLifecycleStatusFromLabelCompatHeuristic({
        lifecycle: DENALI_LIFECYCLE,
        label: "active",
      }),
    );
    assert.equal(
      resolveViaMapping("denali", DENALI_LIFECYCLE, draft),
      resolveLifecycleStatusFromLabelCompatHeuristic({
        lifecycle: DENALI_LIFECYCLE,
        label: "draft",
      }),
    );
    assert.equal(resolveViaMapping("denali", DENALI_LIFECYCLE, active), "OPEN");
    assert.equal(resolveViaMapping("denali", DENALI_LIFECYCLE, draft), "DRAFT");
  });

  it("CW3-06-02 mapping parity matches compat heuristic for urban published/draft/archived", () => {
    const published = urbanCanonical("published");
    const draft = urbanCanonical("draft");
    const archived = urbanCanonical("archived");
    assert.equal(
      resolveViaMapping("urban", URBAN_LIFECYCLE, published),
      resolveLifecycleStatusFromLabelCompatHeuristic({
        lifecycle: URBAN_LIFECYCLE,
        label: "published",
      }),
    );
    assert.equal(
      resolveViaMapping("urban", URBAN_LIFECYCLE, archived),
      resolveLifecycleStatusFromLabelCompatHeuristic({
        lifecycle: URBAN_LIFECYCLE,
        label: "archived",
      }),
    );
    assert.equal(resolveViaMapping("urban", URBAN_LIFECYCLE, published), "PUBLISHED");
    assert.equal(resolveViaMapping("urban", URBAN_LIFECYCLE, draft), "DRAFT");
    assert.equal(resolveViaMapping("urban", URBAN_LIFECYCLE, archived), "DRAFT");
  });

  it("CW3-06-03 mapping parity matches compat heuristic for harbor published/draft", () => {
    const published = harborCanonical("published");
    const draft = harborCanonical("draft");
    assert.equal(
      resolveViaMapping("harbor", HARBOR_LIFECYCLE, published),
      resolveLifecycleStatusFromLabelCompatHeuristic({
        lifecycle: HARBOR_LIFECYCLE,
        label: "published",
      }),
    );
    assert.equal(resolveViaMapping("harbor", HARBOR_LIFECYCLE, published), "PUBLISHED");
    assert.equal(resolveViaMapping("harbor", HARBOR_LIFECYCLE, draft), "DRAFT");
  });

  it("CW3-06-04 assertTourPublishLifecycleOnUpdate behavior unchanged for denali draft→active", () => {
    const before = denaliCanonical("draft");
    const after = denaliCanonical("active");
    assert.doesNotThrow(() =>
      assertTourPublishLifecycleOnUpdate({
        workspaceType: "denali",
        lifecycle: DENALI_LIFECYCLE,
        before,
        after,
      }),
    );
  });
});
