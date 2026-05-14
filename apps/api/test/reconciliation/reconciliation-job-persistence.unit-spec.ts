import assert from "node:assert/strict";
import test from "node:test";
import { InternalServerErrorException } from "@nestjs/common";

import { assertReconciliationJobTenantUpdate } from "../../src/modules/finance/reconciliation/reconciliation-job-alert-hooks";

test("assertReconciliationJobTenantUpdate passes when one row affected", () => {
  assert.doesNotThrow(() =>
    assertReconciliationJobTenantUpdate({ affected: 1, raw: [], generatedMaps: [] } as never, "ctx", "t1", "j1")
  );
});

test("assertReconciliationJobTenantUpdate throws when zero rows affected", () => {
  assert.throws(
    () =>
      assertReconciliationJobTenantUpdate({ affected: 0, raw: [], generatedMaps: [] } as never, "ctx", "t1", "j1"),
    (e: unknown) => e instanceof InternalServerErrorException
  );
});
