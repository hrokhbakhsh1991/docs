import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatWorkspaceDraftAuditLabel,
  resolveWorkspaceDraftResumeHref,
} from "../src/draft/workspace-draft-audit-logic";

describe("workspace-draft-audit-logic", () => {
  it("WEB-P11-17-01 formats namespace and key", () => {
    assert.equal(
      formatWorkspaceDraftAuditLabel({
        draftNamespace: "operator.wizard",
        draftKey: "denali-create",
        version: 2,
        schemaVersion: 1,
        lastModified: 1,
        updatedAt: "2026-06-11T00:00:00.000Z",
      }),
      "operator.wizard / denali-create"
    );
  });

  it("WEB-P11-17-02 resume href for denali create draft", () => {
    assert.equal(
      resolveWorkspaceDraftResumeHref({
        draftNamespace: "operator.wizard",
        draftKey: "denali-create",
        version: 1,
        schemaVersion: 1,
        lastModified: 1,
        updatedAt: "2026-06-11T00:00:00.000Z",
      }),
      "/tours/new"
    );
  });
});
