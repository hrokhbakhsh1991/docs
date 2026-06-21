import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform BFF domains", () => {
  it("exports GET POST", () => {
    const source = readFileSync(
      new URL("../app/api/platform/tenants/[id]/domains/route.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /export async function GET/);
    assert.match(source, /export async function POST/);
    assert.match(source, /\/domains/);
  });
});
