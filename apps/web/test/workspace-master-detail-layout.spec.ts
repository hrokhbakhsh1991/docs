import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  resolve(
    WEB_ROOT,
    "src/features/workspace-resource-panel/workspace-master-detail-layout.tsx"
  ),
  "utf8"
);

describe("workspace-master-detail-layout.spec.ts", () => {
  it("provides a reusable workspace shell for desktop sticky detail and mobile sheet detail", () => {
    assert.match(source, /export function WorkspaceMasterDetailLayout/);
    assert.match(source, /export function WorkspaceStickyDetailCard/);
    assert.match(source, /dir === "rtl"/);
    assert.match(source, /lg:h-\[calc\(100vh-8rem\)\]/);
    assert.match(source, /lg:overflow-y-auto/);
    assert.match(source, /lg:h-full/);
    assert.match(source, /SheetContent/);
  });

  it("keeps the shell generic and free of finance-specific business logic", () => {
    assert.doesNotMatch(source, /payment|receipt|invoice|tourId|registrationId/i);
  });
});
