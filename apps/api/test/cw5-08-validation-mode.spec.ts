import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCanonicalDocument } from "@app-tour/workspace-sdk";

import { resolveValidationMode } from "../src/tours/resolve-validation-mode";

function denaliDoc(publishStatus: string) {
  return createCanonicalDocument({
    schemaVersion: 1,
    roots: ["publishStatus", "basicInfo"],
    data: {
      publishStatus,
      basicInfo: { publishStatus, title: "Alpine day" },
    },
  });
}

describe("CW5-08 resolve-validation-mode tour-core label mapping", () => {
  it("CW5-08-01 denali active resolves publish mode via manifest mapping", () => {
    const doc = denaliDoc("active");
    assert.equal(
      resolveValidationMode({ workspaceType: "denali", tenantId: "t1" }, doc),
      "publish",
    );
  });

  it("CW5-08-02 denali draft resolves draft mode", () => {
    const doc = denaliDoc("draft");
    assert.equal(
      resolveValidationMode({ workspaceType: "denali", tenantId: "t1" }, doc),
      "draft",
    );
  });

  it("CW5-08-03 explicit validationMode wins over label inference", () => {
    const doc = denaliDoc("active");
    assert.equal(
      resolveValidationMode(
        { workspaceType: "denali", tenantId: "t1", validationMode: "draft" },
        doc,
      ),
      "draft",
    );
  });
});
