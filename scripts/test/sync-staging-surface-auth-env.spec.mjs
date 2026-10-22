import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

const repoRoot = resolve(import.meta.dirname, "../..");
const syncScript = join(repoRoot, "scripts/vps-deploy/sync-staging-surface-auth-env.sh");
const verifyScript = join(repoRoot, "scripts/vps-deploy/verify-env-coherence.sh");

const TEST_PEM = "-----BEGIN PUBLIC KEY-----\\nSTAGING_SYNC_TEST_KEY\\n-----END PUBLIC KEY-----";

function fingerprintFromEnvLine(line) {
  const raw = line.replace(/^AUTH_JWT_PUBLIC_KEY=/, "").trim();
  const unquoted = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
  const pem = unquoted.replace(/\\n/g, "\n");
  return createHash("sha256").update(pem).digest("hex").slice(0, 16);
}

function readEnvKey(file, key) {
  const text = readFileSync(file, "utf8");
  const line = text
    .split("\n")
    .filter((row) => row.startsWith(`${key}=`))
    .at(-1);
  return line ?? "";
}

function writeCoherentEnvFixtures(envDir, { mismatchMarketingKey = false } = {}) {
  const apiLine = `AUTH_JWT_PUBLIC_KEY="${TEST_PEM}"`;
  writeFileSync(
    join(envDir, "api.env"),
    [
      "PORT=3001",
      apiLine,
      "AUTH_JWT_ISSUER=tour-ops",
      "AUTH_JWT_AUDIENCE=tour-ops-api",
      "PUBLIC_TENANT_FALLBACK_LABEL=denali",
    ].join("\n") + "\n"
  );
  const surfaceEnv = (name) => {
    const key =
      mismatchMarketingKey && name === "marketing"
        ? 'AUTH_JWT_PUBLIC_KEY="stale-key"\n'
        : apiLine + "\n";
    return (
      [
        "PORT=3000",
        "TOUR_OPS_API_URL=http://127.0.0.1:3001",
        key.trimEnd(),
        "AUTH_JWT_ISSUER=tour-ops",
        "AUTH_JWT_AUDIENCE=tour-ops-api",
        ...(name === "web" || name === "portal" ? ["SESSION_COOKIE_SECURE=true"] : []),
      ].join("\n") + "\n"
    );
  };
  for (const surface of ["web", "portal", "marketing"]) {
    writeFileSync(join(envDir, `${surface}.env`), surfaceEnv(surface));
  }
}

function runVerifier(envDir) {
  return execFileSync("bash", [verifyScript, "--all"], {
    cwd: repoRoot,
    env: { ...process.env, ENV_DIR: envDir },
    encoding: "utf8",
  });
}

describe("sync-staging-surface-auth-env", () => {
  it("REG-STG-AUTH-01 propagates api AUTH_JWT_PUBLIC_KEY to web, portal, marketing (fingerprint only)", () => {
    const envDir = mkdtempSync(join(tmpdir(), "staging-auth-sync-"));
    const apiLine = `AUTH_JWT_PUBLIC_KEY="${TEST_PEM}"`;
    const iss = "AUTH_JWT_ISSUER=tour-ops";
    const aud = "AUTH_JWT_AUDIENCE=tour-ops-api";
    const apiFp = fingerprintFromEnvLine(apiLine);

    writeFileSync(join(envDir, "api.env"), `${apiLine}\n${iss}\n${aud}\n`);
    writeFileSync(join(envDir, "web.env"), "NODE_ENV=production\n");
    writeFileSync(join(envDir, "portal.env"), 'AUTH_JWT_PUBLIC_KEY="stub..."\n');
    writeFileSync(join(envDir, "marketing.env"), "\n");

    const output = execFileSync("bash", [syncScript], {
      cwd: repoRoot,
      env: { ...process.env, ENV_DIR: envDir },
      encoding: "utf8",
    });
    assert.match(output, /sync-staging-surface-auth-env: OK/);

    for (const surface of ["web", "portal", "marketing"]) {
      const pubLine = readEnvKey(join(envDir, `${surface}.env`), "AUTH_JWT_PUBLIC_KEY");
      assert.ok(pubLine.length > 0, `${surface} missing AUTH_JWT_PUBLIC_KEY`);
      assert.equal(fingerprintFromEnvLine(pubLine), apiFp, `${surface} fingerprint mismatch`);
      assert.match(
        readFileSync(join(envDir, `${surface}.env`), "utf8"),
        /AUTH_JWT_ISSUER=tour-ops/
      );
      assert.match(
        readFileSync(join(envDir, `${surface}.env`), "utf8"),
        /AUTH_JWT_AUDIENCE=tour-ops-api/
      );
    }
  });

  it("REG-STG-AUTH-02 replaces stale complete surface keys with the API source of truth", () => {
    const envDir = mkdtempSync(join(tmpdir(), "staging-auth-sync-stale-"));
    const apiLine = `AUTH_JWT_PUBLIC_KEY="${TEST_PEM}"`;
    const portalPem =
      "-----BEGIN PUBLIC KEY-----\\nEXISTING_SURFACE_KEY_LINE_2\\nEXISTING_SURFACE_KEY_LINE_3\\nEXISTING_SURFACE_KEY_LINE_4\\nEXISTING_SURFACE_KEY_LINE_5\\nEXISTING_SURFACE_KEY_LINE_6\\nEXISTING_SURFACE_KEY_LINE_7\\nEXISTING_SURFACE_KEY_LINE_8\\n-----END PUBLIC KEY-----";
    const portalLine = `AUTH_JWT_PUBLIC_KEY="${portalPem}"`;
    const stalePreviousLine = 'AUTH_JWT_PUBLIC_KEY_PREVIOUS="stale-previous-key"';
    writeFileSync(
      join(envDir, "api.env"),
      `${apiLine}\nAUTH_JWT_ISSUER=tour-ops\nAUTH_JWT_AUDIENCE=tour-ops-api\n`
    );
    writeFileSync(join(envDir, "web.env"), "NODE_ENV=production\n");
    writeFileSync(join(envDir, "portal.env"), `${portalLine}\n${stalePreviousLine}\n`);
    writeFileSync(join(envDir, "marketing.env"), "\n");

    execFileSync("bash", [syncScript], {
      cwd: repoRoot,
      env: { ...process.env, ENV_DIR: envDir },
      encoding: "utf8",
    });

    const portalAfter = readEnvKey(join(envDir, "portal.env"), "AUTH_JWT_PUBLIC_KEY");
    assert.equal(fingerprintFromEnvLine(portalAfter), fingerprintFromEnvLine(apiLine));
    assert.equal(readEnvKey(join(envDir, "portal.env"), "AUTH_JWT_PUBLIC_KEY_PREVIOUS"), "");
    assert.match(readEnvKey(join(envDir, "portal.env"), "AUTH_JWT_ISSUER"), /tour-ops/);
    assert.match(readEnvKey(join(envDir, "portal.env"), "AUTH_JWT_AUDIENCE"), /tour-ops-api/);
  });

  it("REG-STG-AUTH-03 rejects surface JWT drift without printing key material", () => {
    const envDir = mkdtempSync(join(tmpdir(), "staging-auth-guard-drift-"));
    writeCoherentEnvFixtures(envDir, { mismatchMarketingKey: true });

    let error;
    try {
      runVerifier(envDir);
    } catch (caught) {
      error = caught;
    }

    assert.ok(error, "expected JWT parity guard to reject the environment");
    assert.match(error.stderr.toString(), /AUTH_JWT_PUBLIC_KEY differs.*marketing\.env/);
    assert.doesNotMatch(error.stderr.toString(), /STAGING_SYNC_TEST_KEY|stale-key/);
  });

  it("REG-STG-AUTH-04 accepts synchronized verifier config", () => {
    const envDir = mkdtempSync(join(tmpdir(), "staging-auth-guard-clean-"));
    writeCoherentEnvFixtures(envDir);
    const output = runVerifier(envDir);
    assert.match(output, /verify-env-coherence: OK/);
  });
});
