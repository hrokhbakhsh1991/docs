import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const WEB_ROOT = process.cwd();

describe("prepayment-playwright-config.spec.ts", () => {
  it("routes prepayment smoke through the dedicated non-finance config", () => {
    const prepaymentConfig = readFileSync(
      resolve(WEB_ROOT, "playwright.prepayment.config.ts"),
      "utf8"
    );
    const operatorConfig = readFileSync(resolve(WEB_ROOT, "playwright.operator.config.ts"), "utf8");
    const packageJson = readFileSync(resolve(WEB_ROOT, "package.json"), "utf8");

    assert.match(prepaymentConfig, /testMatch: \["denali-prepayment-create\.spec\.ts"\]/);
    assert.match(
      prepaymentConfig,
      /OPERATOR_SMOKE_USE_DATABASE=0 node scripts\/smoke-operator-e2e-servers\.mjs/
    );
    assert.doesNotMatch(operatorConfig, /denali-prepayment-create\.spec\.ts/);
    assert.match(packageJson, /"test:e2e:prepayment": "playwright test -c playwright\.prepayment\.config\.ts"/);
  });
});
