import assert from "node:assert/strict";
import test from "node:test";

import { defineAbilityFor } from "@repo/shared";

import {
  canAccessFinanceManualPayments,
  canReviewFinanceReceipts,
  canUploadFinanceReceipts,
  userHasFinanceModuleCapability,
} from "./finance-module-access";

test("userHasFinanceModuleCapability follows tenant finance module", () => {
  assert.equal(
    userHasFinanceModuleCapability({ role: "member", tenantModules: ["finance"] }),
    true,
  );
  assert.equal(
    userHasFinanceModuleCapability({ role: "member", tenantModules: ["form_builder"] }),
    false,
  );
});

test("CASL finance subjects align with upload vs review", () => {
  const member = defineAbilityFor({
    id: "u1",
    role: "member",
    status: "ACTIVE",
    tenantModules: ["finance"],
  });
  assert.equal(canAccessFinanceManualPayments(member), true);
  assert.equal(canUploadFinanceReceipts(member), true);
  assert.equal(
    canReviewFinanceReceipts(member, { role: "member", tenantModules: ["finance"] }),
    false,
  );

  const owner = defineAbilityFor({
    id: "u2",
    role: "owner",
    status: "ACTIVE",
    tenantModules: ["finance"],
  });
  assert.equal(canReviewFinanceReceipts(owner, { role: "owner", tenantModules: ["finance"] }), true);
});
