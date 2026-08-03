/**
 * Thin Shell Phase 4bz — post-binder closure honesty lock.
 * @see docs/dev/thin-shell-post-binder-closure.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(WEB_ROOT, "../..");

describe("thin-shell-post-binder-closure — Phase 4bz", () => {
  it("TS-4BZ-01 closure doc lists Architect-only gates and forbids score chasing", () => {
    const doc = readFileSync(
      resolve(REPO_ROOT, "docs/dev/thin-shell-post-binder-closure.mdoc"),
      "utf8"
    );
    assert.match(doc, /Phase \*\*4bz\*\*/);
    assert.match(doc, /post-binder optional polish list is empty/i);
    assert.match(doc, /Dual-SOT/);
    assert.match(doc, /Hostile audit/);
    assert.match(doc, /Forbidden/);
    assert.match(doc, /Reopening product binders/);
  });

  it("TS-4BZ-02 remaining checklist has no open post-binder polish items", () => {
    const checklist = readFileSync(
      resolve(REPO_ROOT, "docs/dev/thin-shell-remaining-checklist.md"),
      "utf8"
    );
    const section = checklist.split("## Remaining after binder closure")[1] ?? "";
    assert.match(section, /Post-binder optional list:\*\* closed/);
    // No unchecked boxes in the numbered post-binder list
    assert.doesNotMatch(section, /^\d+\. \[ \]/m);
    assert.match(checklist, /Phase \*\*4bz\*\*/);
    assert.match(checklist, /Architect-only remaining gates/);
  });

  it("TS-4BZ-03 stale P0 bullets no longer claim 4k / naming / E2E open", () => {
    const checklist = readFileSync(
      resolve(REPO_ROOT, "docs/dev/thin-shell-remaining-checklist.md"),
      "utf8"
    );
    assert.doesNotMatch(
      checklist,
      /\[ \] \*\*4k\*\* Form binder/
    );
    assert.doesNotMatch(checklist, /E2E Next stub still open/);
    assert.doesNotMatch(checklist, /remaining warm binders still open/);
    assert.match(checklist, /4bx/);
    assert.match(checklist, /4by/);
  });

  it("TS-4BZ-04 remediation references Phase 4bz", () => {
    const remediation = readFileSync(
      resolve(REPO_ROOT, "docs/dev/saas-platform-remediation.mdoc"),
      "utf8"
    );
    assert.match(remediation, /Phase 4bz/);
    assert.match(remediation, /thin-shell-post-binder-closure\.mdoc/);
  });
});
