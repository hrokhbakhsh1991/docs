import assert from "node:assert/strict";
import test from "node:test";

import { OutboxEventEntity } from "../../src/modules/outbox/entities/outbox-event.entity";
import {
  assertOutboxPayloadTenantMatchesRow,
  OutboxPayloadTenantMismatchError,
} from "../../src/modules/outbox/repositories/assert-outbox-payload-tenant-matches-row";

const ROW_TENANT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FOREIGN_TENANT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function buildRow(payload: Record<string, unknown>): OutboxEventEntity {
  const row = new OutboxEventEntity();
  row.id = "11111111-1111-4111-8111-111111111111";
  row.tenantId = ROW_TENANT;
  row.payload = payload;
  return row;
}

test("assertOutboxPayloadTenantMatchesRow rejects metadata.tenantId mismatch", () => {
  assert.throws(
    () =>
      assertOutboxPayloadTenantMatchesRow(
        buildRow({
          metadata: {
            tenantId: FOREIGN_TENANT,
          },
        }),
      ),
    OutboxPayloadTenantMismatchError,
  );
});

test("assertOutboxPayloadTenantMatchesRow accepts matching nested metadata tenantId", () => {
  assert.doesNotThrow(() =>
    assertOutboxPayloadTenantMatchesRow(
      buildRow({
        metadata: {
          TenantId: ROW_TENANT,
          note: "ok",
        },
      }),
    ),
  );
});

test("assertOutboxPayloadTenantMatchesRow rejects metadata tenant_id mismatch", () => {
  assert.throws(
    () =>
      assertOutboxPayloadTenantMatchesRow(
        buildRow({
          metadata: {
            tenant_id: FOREIGN_TENANT,
          },
        }),
      ),
    OutboxPayloadTenantMismatchError,
  );
});

test("assertOutboxPayloadTenantMatchesRow scans deeply nested casing permutations", () => {
  assert.throws(
    () =>
      assertOutboxPayloadTenantMatchesRow(
        buildRow({
          envelope: {
            payload: {
              metadata: {
                TENANT_ID: FOREIGN_TENANT,
              },
            },
          },
        }),
      ),
    OutboxPayloadTenantMismatchError,
  );
});

test("assertOutboxPayloadTenantMatchesRow accepts deeply nested matching tenant tokens", () => {
  assert.doesNotThrow(() =>
    assertOutboxPayloadTenantMatchesRow(
      buildRow({
        metadata: {
          nested: {
            tenantId: ROW_TENANT,
          },
        },
        envelope: {
          TENANTID: ROW_TENANT,
        },
      }),
    ),
  );
});
