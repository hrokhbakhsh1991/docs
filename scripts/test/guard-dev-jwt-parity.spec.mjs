import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

const repoRoot = resolve(import.meta.dirname, "../..");

describe("guard-dev-jwt-parity", () => {
  it("REG-JWT-02 passes when api/marketing/portal fingerprints match", () => {
    const output = execFileSync("node", ["scripts/guard-dev-jwt-parity.mjs"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    assert.match(output, /guard-dev-jwt-parity: OK/);
  });

  it("REG-JWT-03 fails when portal public key diverges", () => {
    const dir = mkdtempSync(join(tmpdir(), "jwt-parity-"));
    const pem = "-----BEGIN PUBLIC KEY-----\\nTEST\\n-----END PUBLIC KEY-----";
    const line = `AUTH_JWT_PUBLIC_KEY="${pem}"`;
    const iss = 'AUTH_JWT_ISSUER="tour-ops"';
    const aud = 'AUTH_JWT_AUDIENCE="tour-ops-api"';

    mkdirSync(join(dir, "apps/api"), { recursive: true });
    mkdirSync(join(dir, "apps/marketing"), { recursive: true });
    mkdirSync(join(dir, "apps/portal"), { recursive: true });

    writeFileSync(join(dir, "apps/api/.env.local"), `${line}\n${iss}\n${aud}\n`);
    writeFileSync(join(dir, "apps/marketing/.env.local"), `${line}\n${iss}\n${aud}\n`);
    writeFileSync(
      join(dir, "apps/portal/.env.local"),
      `AUTH_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\\nOTHER\\n-----END PUBLIC KEY-----"\n${iss}\n${aud}\n`
    );

    let failed = false;
    try {
      execFileSync("node", ["scripts/guard-dev-jwt-parity.mjs"], {
        cwd: repoRoot,
        env: { ...process.env, JWT_PARITY_REPO_ROOT: dir },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      failed = true;
      const combined = `${error.stdout ?? ""}${error.stderr ?? ""}${error.message ?? ""}`;
      assert.match(combined, /mismatch|FAIL/);
    }
    assert.equal(failed, true);
  });
});
