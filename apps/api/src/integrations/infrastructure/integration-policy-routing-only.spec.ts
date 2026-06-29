import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const repoRoot = join(import.meta.dirname, "../../../../..");

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("integration event policy routing-only contract", () => {
  it("keeps Prisma IntegrationEventPolicy free of field/template storage", () => {
    const schema = read("apps/api/prisma/schema.prisma");
    const model = schema.match(/model IntegrationEventPolicy \{[\s\S]*?\n\}/)?.[0] ?? "";

    assert.match(model, /eventType\s+String/);
    assert.match(model, /enabled\s+Boolean/);
    assert.doesNotMatch(model, /selectedFieldIds|selected_field_ids/);
    assert.doesNotMatch(model, /messageTemplate|message_template/);
  });

  it("keeps policy repository records scoped to routing fields only", () => {
    const contract = read(
      "apps/api/src/integrations/infrastructure/integration-policy.repository.ts",
    );
    const record = contract.match(/export type IntegrationEventPolicyRecord = \{[\s\S]*?\n\};/)?.[0] ?? "";

    assert.match(record, /eventType/);
    assert.match(record, /enabled/);
    assert.doesNotMatch(record, /selectedFieldIds|messageTemplate/);
  });
});
