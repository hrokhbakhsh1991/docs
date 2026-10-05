import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

function listFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path));
    else if (entry.name.endsWith(".ts")) files.push(path);
  }
  return files;
}

describe("CW1-06 capacity strategy consumer census", () => {
  it("no non-re-export production imports of legacy registration-capacity math paths", () => {
    const compatPaths = new Set([
      "apps/api/src/registrations/registration-capacity.service.ts",
      "apps/api/src/registrations/index.ts",
    ]);
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
    const roots = [join(repoRoot, "apps/api/src"), join(repoRoot, "packages/workspaces")];
    const output = roots
      .flatMap((root) => listFiles(root))
      .filter((file) => !file.endsWith(".spec.ts"))
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return source.includes("resolveRegistrationCapacityDecision") ||
          source.includes("sumAcceptedRegistrationSeats");
      })
      .map((file) => relative(repoRoot, file).replaceAll("\\", "/"))
      .filter((rel) => !compatPaths.has(rel))
      .join("\n");
    assert.equal(output, "", `unexpected legacy capacity imports:\n${output}`);
  });
});
