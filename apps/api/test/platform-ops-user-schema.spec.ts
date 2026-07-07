import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("PlatformOpsUser schema", () => {
  it("insert ops user", () => {
    const schema = readFileSync(
      new URL("../prisma/schema.prisma", import.meta.url),
      "utf8"
    );
    const modelMatch = schema.match(/model PlatformOpsUser \{[\s\S]*?\n\}/);
    assert.ok(modelMatch, "PlatformOpsUser model should exist");
    const modelBlock = modelMatch[0];
    assert.match(modelBlock, /phone\s+String\s+@unique/);
    assert.match(modelBlock, /role\s+String/);
    assert.doesNotMatch(modelBlock, /password/i);

    const repositorySource = readFileSync(
      new URL("../src/platform/platform-ops-user.repository.ts", import.meta.url),
      "utf8"
    );
    assert.match(repositorySource, /upsert/);
    assert.match(repositorySource, /platformOpsUser/);
  });
});
