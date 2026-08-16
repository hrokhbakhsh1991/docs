import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const marketingRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(marketingRoot, "../..");

function walkTsFiles(dir: string, out: string[] = []): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    return out;
  }
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      walkTsFiles(full, out);
    } else if (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("marketing Phase 4 — still not an auth host", () => {
  it("MKT-PCMS-P4-01 no OTP adapter, CORS, or public-auth BFF on marketing", () => {
    const files = [
      ...walkTsFiles(join(marketingRoot, "src")),
      ...walkTsFiles(join(marketingRoot, "app")),
    ];
    assert.ok(files.length > 0);
    for (const file of files) {
      const rel = file.slice(repoRoot.length + 1);
      const text = readFileSync(file, "utf8");
      assert.doesNotMatch(text, /createPortalSameOriginGuestAuthTransport/, rel);
      assert.doesNotMatch(text, /GuestAuthHostProvider/, rel);
      assert.doesNotMatch(text, /Access-Control-Allow-Origin/, rel);
      assert.doesNotMatch(text, /app\/api\/public-auth/, rel);
    }
  });
});
