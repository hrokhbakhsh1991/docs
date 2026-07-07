import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform layout boundary", () => {
  it("PATTERN-C no denali/ui", () => {
    const layout = readFileSync(
      new URL("../app/(platform)/layout.tsx", import.meta.url),
      "utf8"
    );
    const shell = readFileSync(new URL("../src/platform/platform-shell.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(layout, /denali\/ui/);
    assert.doesNotMatch(shell, /denali\/ui/);
  });

  it("has nav", () => {
    const shell = readFileSync(new URL("../src/platform/platform-shell.tsx", import.meta.url), "utf8");
    assert.match(shell, /navItems\.map/);
  });
});
