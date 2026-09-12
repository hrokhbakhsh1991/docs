import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allowsOperatorMarketingPagesTeamRole,
  isOperatorMarketingPagesTeamAccessPath,
} from "../src/features/settings/resolve-operator-marketing-pages-middleware-access";

describe("operator marketing pages middleware access", () => {
  it("MKP-MW-01 viewer may GET settings and BFF", () => {
    assert.equal(isOperatorMarketingPagesTeamAccessPath("/settings/marketing-pages"), true);
    assert.equal(
      isOperatorMarketingPagesTeamAccessPath("/api/settings/marketing-pages/home-hero"),
      true,
    );
    assert.equal(allowsOperatorMarketingPagesTeamRole("viewer", "GET"), true);
    assert.equal(allowsOperatorMarketingPagesTeamRole("viewer", "PATCH"), false);
  });

  it("MKP-MW-02 owner may mutate", () => {
    assert.equal(allowsOperatorMarketingPagesTeamRole("owner", "PATCH"), true);
    assert.equal(allowsOperatorMarketingPagesTeamRole("admin", "POST"), true);
  });
});
