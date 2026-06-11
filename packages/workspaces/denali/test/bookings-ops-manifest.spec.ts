/**
 * Phase 9.5 — Denali registration ops manifest (REQ-P9-052 · DEC-P9-011).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  denaliRegistrationOpsManifest,
  getDenaliRegistrationOpsManifest,
} from "../src/bookings/ops-manifest";
import { getDenaliWorkspacePlugin } from "../src/denali.plugin";

describe("bookings-ops-manifest.spec.ts — workspace-denali", () => {
  it("DN-9.5-01 denaliRegistrationOpsManifest includes inbox_table default", () => {
    const manifest = getDenaliRegistrationOpsManifest();
    assert.equal(manifest.defaultView, "inbox_table");
    assert.ok(manifest.views.includes("inbox_table"));
    assert.deepEqual(manifest.columns.inbox_table, denaliRegistrationOpsManifest.columns.inbox_table);
    assert.equal(getDenaliWorkspacePlugin().registrationOps?.manifest.id, "denali_registration_ops");
  });
});
