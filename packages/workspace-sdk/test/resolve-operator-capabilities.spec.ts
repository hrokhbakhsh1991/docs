import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  operatorCapabilitySupportsFieldExposureSurfaces,
  operatorCapabilitySupportsReconciliationTriage,
  operatorCapabilitySupportsUsersDirectory,
  WORKSPACE_OPERATOR_CAPABILITIES,
} from "../src/public-api";

describe("resolve-operator-capabilities — Phase C1", () => {
  it("SDK-C1-01 codegen maps denali operator capabilities", () => {
    assert.deepEqual(WORKSPACE_OPERATOR_CAPABILITIES.denali, {
      usersDirectory: true,
      reconciliationTriage: true,
      fieldExposureSurfaces: true,
    });
  });

  it("SDK-C1-02 codegen maps urban operator capabilities", () => {
    assert.deepEqual(WORKSPACE_OPERATOR_CAPABILITIES.urban, {
      usersDirectory: false,
      reconciliationTriage: false,
      fieldExposureSurfaces: false,
    });
  });

  it("SDK-C1-04 codegen maps guest-club operator capabilities (PSC-C-04)", () => {
    assert.deepEqual(WORKSPACE_OPERATOR_CAPABILITIES["guest-club"], {
      usersDirectory: false,
      reconciliationTriage: false,
      fieldExposureSurfaces: false,
    });
  });

  it("SDK-C1-03 unknown workspace type is fail-closed", () => {
    assert.equal(operatorCapabilitySupportsUsersDirectory("starter"), false);
    assert.equal(operatorCapabilitySupportsReconciliationTriage("starter"), false);
    assert.equal(operatorCapabilitySupportsFieldExposureSurfaces("starter"), false);
  });

  it("SDK-C1-05 field exposure surfaces capability (PSC-C-16)", () => {
    assert.equal(operatorCapabilitySupportsFieldExposureSurfaces("denali"), true);
    assert.equal(operatorCapabilitySupportsFieldExposureSurfaces("urban"), false);
    assert.equal(operatorCapabilitySupportsFieldExposureSurfaces("guest-club"), false);
  });
});
