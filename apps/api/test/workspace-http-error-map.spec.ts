/**
 * P0 T-013/T-135 — workspace HTTP error map codegen
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DenaliOwnerRequiredError } from "@app-tour/workspace-denali/host/http";
import { UrbanRegistrationDuplicateError } from "@app-tour/workspace-urban/http";

import {
  resolveWorkspaceHttpErrorCodeStatus,
  WORKSPACE_HTTP_ERROR_RESPONSE_BINDINGS,
} from "../src/middleware/workspace-http-error-map.generated";

describe("workspace-http-error-map.spec.ts — P0 T-135", () => {
  it("API-P0-135-01 exposes denali + urban workspace error bindings", () => {
    assert.ok(WORKSPACE_HTTP_ERROR_RESPONSE_BINDINGS.length >= 6);
    const workspaceIds = new Set(
      WORKSPACE_HTTP_ERROR_RESPONSE_BINDINGS.map((binding) => binding.workspaceId)
    );
    assert.ok(workspaceIds.has("denali"));
    assert.ok(workspaceIds.has("urban"));
  });

  it("API-P0-135-02 resolves status codes for registration duplicate errors", () => {
    assert.equal(resolveWorkspaceHttpErrorCodeStatus("URBAN_REGISTRATION_DUPLICATE"), 409);
    assert.equal(resolveWorkspaceHttpErrorCodeStatus("DENALI_REGISTRATION_DUPLICATE"), 409);
  });

  it("API-P0-135-03 binding isError guards match typed workspace errors", () => {
    const denaliOwner = WORKSPACE_HTTP_ERROR_RESPONSE_BINDINGS.find(
      (binding) => binding.code === "DENALI_OWNER_REQUIRED"
    );
    assert.ok(denaliOwner);
    assert.equal(denaliOwner.isError(new DenaliOwnerRequiredError()), true);
    assert.equal(denaliOwner.isError(new Error("OTHER")), false);

    const urbanDuplicate = WORKSPACE_HTTP_ERROR_RESPONSE_BINDINGS.find(
      (binding) => binding.code === "URBAN_REGISTRATION_DUPLICATE"
    );
    assert.ok(urbanDuplicate);
    assert.equal(urbanDuplicate.isError(new UrbanRegistrationDuplicateError()), true);
  });
});
