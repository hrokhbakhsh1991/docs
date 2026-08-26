/**
 * Operator sheet side + motion direction mapping.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  resolveOperatorDetailSheetSide,
  resolveOperatorNavSheetSide,
} from "../src/i18n/resolve-operator-sheet-side";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("resolve-operator-sheet-side.spec.ts", () => {
  it("WEB-SHEET-01 RTL detail sheet attaches to physical left", () => {
    assert.equal(resolveOperatorDetailSheetSide("fa"), "left");
    assert.equal(resolveOperatorDetailSheetSide("en"), "right");
  });

  it("WEB-SHEET-02 RTL nav sheet attaches to physical right", () => {
    assert.equal(resolveOperatorNavSheetSide("fa"), "right");
    assert.equal(resolveOperatorNavSheetSide("en"), "left");
  });

  it("WEB-SHEET-03 motion CSS binds enter-from to matching slide keyframes", () => {
    const motionCss = readFileSync(
      resolve(WEB_ROOT, "../../packages/design-tokens/src/operator-sheet-motion.css"),
      "utf8"
    );
    assert.match(
      motionCss,
      /\[data-operator-sheet-enter-from="left"\]\[data-state="open"\][\s\S]*operator-sheet-slide-in-left/
    );
    assert.match(
      motionCss,
      /\[data-operator-sheet-enter-from="left"\]\[data-state="closed"\][\s\S]*operator-sheet-slide-out-left/
    );
    assert.match(
      motionCss,
      /\[data-operator-sheet-enter-from="right"\]\[data-state="open"\][\s\S]*operator-sheet-slide-in-right/
    );
    assert.match(
      motionCss,
      /\[data-operator-sheet-enter-from="right"\]\[data-state="closed"\][\s\S]*operator-sheet-slide-out-right/
    );
    assert.match(motionCss, /\[data-operator-sheet-side="left"\][\s\S]*left:\s*0/);
    assert.match(motionCss, /\[data-operator-sheet-side="right"\][\s\S]*right:\s*0/);
  });

  it("WEB-SHEET-04 shared Sheet exposes enter-from attribute", () => {
    const sheet = readFileSync(resolve(WEB_ROOT, "src/components/ui/sheet.tsx"), "utf8");
    assert.match(sheet, /data-operator-sheet-enter-from=\{enterFrom\}/);
    assert.doesNotMatch(sheet, /slide-in-from-left/);
  });
});
