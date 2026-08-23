import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertFinanceCaseMeaningWorkspace,
  FinanceCaseMeaningWorkspaceUnsupportedError,
} from "./build-live-denali-case-read-deps.ts";

describe("buildLiveDenaliCaseReadDepsForTenant workspace gate", () => {
  it("allows only workspaces with Finance Case Meaning capability", () => {
    assert.doesNotThrow(() => assertFinanceCaseMeaningWorkspace("denali"));
    assert.doesNotThrow(() => assertFinanceCaseMeaningWorkspace(" Denali "));
  });

  it("fails closed for finance workspaces without case meaning", () => {
    assert.throws(
      () => assertFinanceCaseMeaningWorkspace("finance-ws5"),
      FinanceCaseMeaningWorkspaceUnsupportedError
    );
  });

  it("fails closed for unknown workspaces", () => {
    assert.throws(
      () => assertFinanceCaseMeaningWorkspace("alpine"),
      FinanceCaseMeaningWorkspaceUnsupportedError
    );
  });
});
