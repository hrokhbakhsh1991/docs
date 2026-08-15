import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const WEB_ROOT = process.cwd();

describe("operator-smoke-env.spec.ts", () => {
  it("pins operator smoke prisma runtime to local Postgres defaults", () => {
    const source = readFileSync(
      resolve(WEB_ROOT, "scripts/smoke-operator-e2e-servers.mjs"),
      "utf8"
    );

    assert.match(source, /const operatorSmokeDbUrl =/);
    assert.match(source, /127\.0\.0\.1:5434\/app_tour_dev/);
    assert.match(source, /const operatorSmokeDbAdminUrl =/);
    assert.match(source, /postgres:postgres@127\.0\.0\.1:5434\/app_tour_dev/);
    assert.match(source, /DATABASE_URL: operatorSmokeDbUrl/);
    assert.match(source, /DATABASE_URL_ADMIN: operatorSmokeDbAdminUrl/);
    assert.match(source, /function waitForUrlOrChildExit/);
    assert.match(source, /\$\{label\} exited before readiness/);
  });
});
