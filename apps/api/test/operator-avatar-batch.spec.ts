/**
 * Operator avatar batch presign — directory list performance.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveOperatorAvatarUrlsForMemberships,
  type OperatorAvatarMembershipRef,
} from "../src/identity/operator-avatar-storage";

const TENANT_ID = "00000000-0000-4000-8000-000000000003";
const USER_A = "00000000-0000-4000-8000-000000000201";
const USER_B = "00000000-0000-4000-8000-000000000202";

const MINIO_ENV_KEYS = [
  "MINIO_ENDPOINT",
  "MINIO_ACCESS_KEY",
  "MINIO_SECRET_KEY",
  "MINIO_BUCKET",
  "MINIO_USE_SSL",
  "MINIO_REGION",
] as const;

describe("operator-avatar-batch.spec.ts", () => {
  it("AVT-BATCH-01 empty input returns empty array", async () => {
    const urls = await resolveOperatorAvatarUrlsForMemberships([]);
    assert.deepEqual(urls, []);
  });

  it("AVT-BATCH-01 all empty storage keys return null without MinIO", async () => {
    const inputs: OperatorAvatarMembershipRef[] = [
      { tenantId: TENANT_ID, userId: USER_A, storageKey: undefined },
      { tenantId: TENANT_ID, userId: USER_B, storageKey: "   " },
    ];
    const urls = await resolveOperatorAvatarUrlsForMemberships(inputs);
    assert.equal(urls.length, 2);
    assert.equal(urls[0], null);
    assert.equal(urls[1], null);
  });

  it("AVT-BATCH-02 mixed keys preserve output length when MinIO unset", async () => {
    const saved: Partial<Record<(typeof MINIO_ENV_KEYS)[number], string | undefined>> = {};
    for (const key of MINIO_ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    try {
      const inputs: OperatorAvatarMembershipRef[] = [
        { tenantId: TENANT_ID, userId: USER_A, storageKey: undefined },
        {
          tenantId: TENANT_ID,
          userId: USER_B,
          storageKey: `${TENANT_ID}/operators/${USER_B}/avatar`,
        },
      ];
      const urls = await resolveOperatorAvatarUrlsForMemberships(inputs);
      assert.equal(urls.length, inputs.length);
      assert.equal(urls[0], null);
      assert.equal(urls[1], null);
    } finally {
      for (const key of MINIO_ENV_KEYS) {
        const value = saved[key];
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});
