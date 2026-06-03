import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SDK_ROOT = path.resolve(__dirname, "..");
const BARREL_PROBE = path.join(__dirname, "import-purity-barrel-probe.mjs");

describe("workspace-sdk import purity", () => {
  it("barrel import does not load @casl/ability into require.cache", () => {
    const r = spawnSync(process.execPath, [BARREL_PROBE], {
      cwd: SDK_ROOT,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    });

    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
    assert.equal(
      r.status,
      0,
      out.includes("PURE_BARREL_OK") ? out : `barrel purity probe failed:\n${out}`,
    );
    assert.match(out, /PURE_BARREL_OK/);
  });

  it("dist barrel exposes frozen presets and starter without eager CASL (subprocess)", () => {
    const probe = `
      const sdk = await import(${JSON.stringify(path.join(SDK_ROOT, "dist/index.js"))});
      const presets = sdk.workspaceThemePresets ?? sdk.getWorkspaceThemePresets();
      const map = typeof presets === "function" ? presets() : presets;
      if (!Object.isFrozen(map)) process.exit(1);
      const plugin = sdk.starterWorkspacePlugin ?? sdk.getStarterWorkspacePlugin();
      if (!plugin || plugin.id !== "starter") process.exit(2);
      const require = (await import("node:module")).createRequire(import.meta.url);
      const casl = Object.keys(require.cache).filter(k => /@casl[\\\\/]ability/.test(k)).length;
      if (casl !== 0) process.exit(3);
      console.log("DIST_PRESETS_OK");
    `;
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", probe], {
      cwd: SDK_ROOT,
      encoding: "utf8",
    });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
    assert.equal(r.status, 0, out);
    assert.match(out, /DIST_PRESETS_OK/);
  });

  it("auth/casl subpath loads @casl/ability; root and auth barrels do not", async () => {
    const probe = `
      import { createRequire } from "node:module";
      import path from "node:path";
      const require = createRequire(import.meta.url);
      const root = ${JSON.stringify(SDK_ROOT)};
      const before = Object.keys(require.cache).filter(k => /@casl[\\\\/]ability/.test(k)).length;
      await import(path.join(root, "dist", "index.js"));
      const afterBarrel = Object.keys(require.cache).filter(k => /@casl[\\\\/]ability/.test(k)).length;
      const auth = await import(path.join(root, "dist", "auth", "index.js"));
      const afterAuth = Object.keys(require.cache).filter(k => /@casl[\\\\/]ability/.test(k)).length;
      const casl = await import(path.join(root, "dist", "auth", "casl", "index.js"));
      const afterCasl = Object.keys(require.cache).filter(k => /@casl[\\\\/]ability/.test(k)).length;
      casl.defineAbilityFor({ userId: "u1", tenantId: "t1", workspaceId: "w1", role: "owner", status: "ACTIVE" });
      if (before !== 0 || afterBarrel !== 0 || afterAuth !== 0 || afterCasl === 0) process.exit(1);
      console.log("CASL_AUTH_CASL_SUBPATH_OK");
    `;
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", probe], {
      cwd: SDK_ROOT,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    assert.match(`${r.stdout}`, /CASL_AUTH_CASL_SUBPATH_OK/);
  });
});
