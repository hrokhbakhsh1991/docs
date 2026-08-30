/**
 * Users member detail — loyalty tier selector layout regression.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { USERS_DIRECTORY_TEST_IDS } from "../src/features/users/users-directory-types";

describe("users-loyalty-tier-selector.spec.ts", () => {
  it("WEB-USERS-LOY-01 loyalty selector uses ui-primitives Input for compact radios", () => {
    const sheet = readFileSync("app/(app)/users/users-member-detail-sheet.tsx", "utf8");
    const selector = readFileSync("app/(app)/users/users-loyalty-tier-selector.tsx", "utf8");

    assert.doesNotMatch(sheet, /PrimitiveInput/);
    assert.doesNotMatch(sheet, /type="radio"/);
    assert.match(selector, /role="radiogroup"/);
    assert.match(selector, /type="radio"/);
    assert.match(selector, /size-4/);
    assert.match(selector, /@app-tour\/ui-primitives\/input/);
    assert.equal(
      USERS_DIRECTORY_TEST_IDS.rewardsLoyaltyTier,
      "operator-users-rewards-loyalty-tier"
    );
  });

  it("WEB-USERS-LOY-02 loyalty legend uses single operator-facing label key", () => {
    const selector = readFileSync("app/(app)/users/users-loyalty-tier-selector.tsx", "utf8");
    const faUsers = JSON.parse(readFileSync("messages/fa/users.json", "utf8")) as {
      rewards: { loyaltyTierLabel: string };
    };

    assert.equal(faUsers.rewards.loyaltyTierLabel, "سطح وفاداری");
    assert.equal(
      (selector.match(/rewards\.loyaltyTierLabel/g) ?? []).length,
      1,
      "legend should reference loyaltyTierLabel once"
    );
  });
});
