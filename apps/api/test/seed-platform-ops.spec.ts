import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { PlatformOpsUserRow } from "../src/platform/platform-ops-user.repository.ts";
import { parsePlatformOpsSeed } from "../src/platform/parse-platform-ops-seed.ts";

async function seedPlatformOpsUsers(
  deps: {
    repository: {
      upsert(input: { phone: string; role: string }): Promise<PlatformOpsUserRow>;
    };
    seedCsv?: string;
  }
): Promise<number> {
  const seeds = parsePlatformOpsSeed(deps.seedCsv);
  for (const seed of seeds) {
    await deps.repository.upsert(seed);
  }
  return seeds.length;
}

describe("seed-platform-ops", () => {
  it("second run no dup", async () => {
    const rows = new Map<string, PlatformOpsUserRow>();
    const repository = {
      async upsert(input: { phone: string; role: string }) {
        const existing = rows.get(input.phone);
        const row = {
          phone: input.phone,
          role: input.role,
          createdAt: existing?.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
        };
        rows.set(input.phone, row);
        return row;
      },
    };

    const seedCsv = "+10000000001:owner,+10000000002:support";
    assert.deepEqual(parsePlatformOpsSeed(seedCsv), [
      { phone: "+10000000001", role: "owner" },
      { phone: "+10000000002", role: "support" },
    ]);

    const first = await seedPlatformOpsUsers({ repository, seedCsv });
    const second = await seedPlatformOpsUsers({ repository, seedCsv });
    assert.equal(first, 2);
    assert.equal(second, 2);
    assert.equal(rows.size, 2);
  });
});
