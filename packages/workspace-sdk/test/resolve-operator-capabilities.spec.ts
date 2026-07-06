import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  operatorCapabilitySupportsReconciliationTriage,
  operatorCapabilitySupportsUsersDirectory,
  WORKSPACE_OPERATOR_CAPABILITIES,
} from "../src/public-api";

describe("resolve-operator-capabilities — Phase C1", () => {
  it("SDK-C1-01 codegen maps denali operator capabilities", () => {
    assert.deepEqual(WORKSPACE_OPERATOR_CAPABILITIES.denali, {
      usersDirectory: true,
      reconciliationTriage: true,
    });
  });

  it("SDK-C1-02 codegen maps urban operator capabilities", () => {
    assert.deepEqual(WORKSPACE_OPERATOR_CAPABILITIES.urban, {
      usersDirectory: false,
      reconciliationTriage: false,
    });
  });

  it("SDK-C1-03 unknown workspace type is fail-closed", () => {
    assert.equal(operatorCapabilitySupportsUsersDirectory("starter"), false);
    assert.equal(operatorCapabilitySupportsReconciliationTriage("starter"), false);
  });
});
