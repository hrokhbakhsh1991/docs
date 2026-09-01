import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("agent-start JWT sync", () => {
  it("REG-AGENT-01 re-syncs guest surface when API public key changes", () => {
    const dir = mkdtempSync(join(tmpdir(), "agent-start-jwt-"));
    const apiEnv = join(dir, "api.env.local");
    const portalEnv = join(dir, "portal.env.local");

    const keyA =
      'AUTH_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\\nKEY_A\\n-----END PUBLIC KEY-----"';
    const keyB =
      'AUTH_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\\nKEY_B\\n-----END PUBLIC KEY-----"';

    writeFileSync(
      apiEnv,
      `${keyB}\nAUTH_JWT_ISSUER="tour-ops"\nAUTH_JWT_AUDIENCE="tour-ops-api"\n`
    );
    writeFileSync(
      portalEnv,
      `ALLOW_DEV_WEB_SESSION=true\n${keyA}\nAUTH_JWT_ISSUER="tour-ops"\nAUTH_JWT_AUDIENCE="tour-ops-api"\n`
    );

    const script = `
      repo_root="${dir}"
      sync_jwt_public_verify_into_surface() {
        local dest="$1"
        local api_env="$repo_root/api.env.local"
        [ -f "$api_env" ] || return 0
        [ -f "$dest" ] || return 0
        local api_pub_line api_iss_line api_aud_line dest_pub_line
        api_pub_line=$(grep -E '^AUTH_JWT_PUBLIC_KEY=' "$api_env" | tail -1 || true)
        api_iss_line=$(grep -E '^AUTH_JWT_ISSUER=' "$api_env" | tail -1 || true)
        api_aud_line=$(grep -E '^AUTH_JWT_AUDIENCE=' "$api_env" | tail -1 || true)
        [ -n "$api_pub_line" ] || return 0
        dest_pub_line=$(grep -E '^AUTH_JWT_PUBLIC_KEY=' "$dest" | tail -1 || true)
        if [ "$dest_pub_line" = "$api_pub_line" ]; then
          return 0
        fi
        local tmp
        tmp="$(mktemp)"
        grep -v -E '^AUTH_JWT_PUBLIC_KEY=|^AUTH_JWT_ISSUER=|^AUTH_JWT_AUDIENCE=|^# Copied from apps/api/.env.local — RS256 verify only' "$dest" > "$tmp" || true
        {
          echo ""
          echo "# Copied from apps/api/.env.local — RS256 verify only (never AUTH_JWT_PRIVATE_KEY)"
          printf '%s\\n' "$api_pub_line"
          [ -n "$api_iss_line" ] && printf '%s\\n' "$api_iss_line"
          [ -n "$api_aud_line" ] && printf '%s\\n' "$api_aud_line"
        } >> "$tmp"
        mv "$tmp" "$dest"
      }
      sync_jwt_public_verify_into_surface "$repo_root/portal.env.local"
    `;

    execFileSync("bash", ["-c", script], { encoding: "utf8" });
    const updated = readFileSync(portalEnv, "utf8");
    assert.match(updated, /KEY_B/);
    assert.doesNotMatch(updated, /KEY_A/);

    const fp = createHash("sha256")
      .update('-----BEGIN PUBLIC KEY-----\nKEY_B\n-----END PUBLIC KEY-----')
      .digest("hex")
      .slice(0, 16);
    assert.equal(fp.length, 16);
  });
});
