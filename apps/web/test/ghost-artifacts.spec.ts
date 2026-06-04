import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const WEB_CONSUMED = [
  { pkgDir: "packages/ui-primitives", spec: "@app-tour/ui-primitives/button", exportKey: "./button" },
  { pkgDir: "packages/ui-primitives", spec: "@app-tour/ui-primitives/input", exportKey: "./input" },
  { pkgDir: "packages/ui-primitives", spec: "@app-tour/ui-primitives/select", exportKey: "./select" },
  { pkgDir: "packages/ui-primitives", spec: "@app-tour/ui-primitives/checkbox", exportKey: "./checkbox" },
  { pkgDir: "packages/theme-react", spec: "@app-tour/theme-react", exportKey: "." },
] as const;

function readPkgExports(packageDir: string): Record<string, unknown> {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, packageDir, "package.json"), "utf8")) as {
    exports?: Record<string, unknown>;
  };
  return pkg.exports ?? {};
}

function resolveExportTarget(packageDir: string, exportKey: string): string {
  const exportsMap = readPkgExports(packageDir);
  const entry = exportsMap[exportKey];
  const target =
    typeof entry === "object" && entry !== null && "default" in entry
      ? String((entry as { default: string }).default)
      : typeof entry === "string"
        ? entry
        : null;
  assert.ok(target, `missing export target for ${exportKey}`);
  return join(REPO_ROOT, packageDir, target);
}

describe("ghost artifacts — app imports map to explicit package exports", () => {
  for (const { pkgDir, exportKey } of WEB_CONSUMED) {
    it(`${pkgDir} export ${exportKey} resolves to a published dist file`, () => {
      const abs = resolveExportTarget(pkgDir, exportKey);
      assert.ok(statSync(abs).isFile(), `export target missing on disk: ${abs}`);
    });
  }

  it("ui-primitives dist/utils is not a public export (internal only)", () => {
    const exportsMap = readPkgExports("packages/ui-primitives");
    assert.equal(exportsMap["./utils"], undefined);
  });
});
