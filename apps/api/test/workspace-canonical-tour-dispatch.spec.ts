/**
 * P15-P-B3 — manifest-driven canonical tour dispatch
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCanonicalDocument } from "@app-tour/workspace-sdk";
import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";
import { migrateDenaliCanonical } from "@app-tour/workspace-denali/host/acl";

import {
  detectTourPublishTransition,
  readTourPublishStatusLabel,
  resolveMigrateCanonicalHook,
} from "../src/canonical/workspace-canonical-tour-dispatch";
import { resolveWorkspaceTypeForTenant } from "../src/tenant/resolve-workspace-type";

describe("workspace-canonical-tour-dispatch.spec.ts — P15-P-B3", () => {
  it("API-P15-B3-01 readTourPublishStatusLabel uses denali binding", () => {
    const canonical = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["publishStatus"],
      data: { publishStatus: "active" },
    });
    assert.equal(readTourPublishStatusLabel("denali", canonical), "active");
  });

  it("API-P15-B3-02 readTourPublishStatusLabel uses urban binding", () => {
    const canonical = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["tour"],
      data: { tour: { publishStatus: "published", title: "Walk" } },
    });
    assert.equal(readTourPublishStatusLabel("urban", canonical), "published");
  });

  it("API-P15-B3-03 resolveMigrateCanonicalHook returns denali ACL migrate", async () => {
    const workspaceType = await resolveWorkspaceTypeForTenant(DENALI_SMOKE_TENANT_ID);
    const hook = resolveMigrateCanonicalHook(workspaceType);
    assert.equal(hook, migrateDenaliCanonical);
  });

  it("API-P15-B3-04 detectTourPublishTransition delegates to workspace binding", () => {
    const before = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["tour"],
      data: { tour: { title: "Walk", publishStatus: "draft" } },
    });
    const after = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["tour"],
      data: { tour: { title: "Walk", publishStatus: "published" } },
    });
    assert.equal(detectTourPublishTransition("urban", before, after), "published");
  });
});
