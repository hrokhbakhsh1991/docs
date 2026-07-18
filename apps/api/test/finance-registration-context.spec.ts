/**
 * Phase B — finance registration context helpers (tenant filter + attach).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  attachFinanceRegistrationContext,
  filterRowsByRegistrationId,
  type FinanceRegistrationContext,
} from "../src/workspace-finance/finance-registration-context.ts";

describe("finance-registration-context.spec.ts", () => {
  it("B-01 filterRowsByRegistrationId keeps only matching rows", () => {
    const rows = [
      { registrationId: "a", amount: "1" },
      { registrationId: "b", amount: "2" },
      { registrationId: "a", amount: "3" },
    ];
    assert.deepEqual(filterRowsByRegistrationId(rows, undefined), rows);
    assert.deepEqual(filterRowsByRegistrationId(rows, "a"), [
      { registrationId: "a", amount: "1" },
      { registrationId: "a", amount: "3" },
    ]);
    assert.deepEqual(filterRowsByRegistrationId(rows, "missing"), []);
  });

  it("B-02 attachFinanceRegistrationContext is null when map lacks id", () => {
    const contexts = new Map<string, FinanceRegistrationContext>();
    const attached = attachFinanceRegistrationContext(
      { registrationId: "reg-1", id: "pay-1" },
      contexts
    );
    assert.equal(attached.registrationContext, null);
    assert.equal(attached.registrationId, "reg-1");
  });

  it("B-03 attachFinanceRegistrationContext copies projection fields", () => {
    const ctx: FinanceRegistrationContext = {
      registrationId: "reg-1",
      tourId: "tour-1",
      tourTitle: "North Ridge",
      memberDisplayName: "Ali",
    };
    const contexts = new Map([["reg-1", ctx]]);
    const attached = attachFinanceRegistrationContext(
      { registrationId: "reg-1", id: "pay-1" },
      contexts
    );
    assert.deepEqual(attached.registrationContext, ctx);
  });
});
