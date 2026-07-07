#!/usr/bin/env node
/**
 * Phase 11 — wizard post-submit must redirect to /tours without engine clearDraft.
 * @see docs/phase-11/tour-clone-hydration.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function assertMatch(label, source, pattern) {
  if (!pattern.test(source)) {
    console.error(`guard-wizard-post-submit-contract: FAIL ${label}`);
    process.exit(1);
  }
}

function assertNoMatch(label, source, pattern) {
  if (pattern.test(source)) {
    console.error(`guard-wizard-post-submit-contract: FAIL ${label}`);
    process.exit(1);
  }
}

const denaliHook = read("apps/web/src/wizard/use-denali-create-tour-wizard.ts");
const workspaceClient = read("apps/web/src/wizard/workspace-create-tour-wizard-client.tsx");
const denaliCore = read("packages/workspaces/denali/src/ui/chrome/use-create-tour-wizard-core.ts");
const postSubmit = read("apps/web/src/tours/run-create-tour-post-submit-success.ts");
const postSubmitDiscard = read("apps/web/src/tours/create-tour-post-submit-discard.ts");
const photoBindings = read(
  "apps/web/src/bootstrap/workspace-photo-upload-errors-bindings.generated.ts"
);

assertMatch("denali hook uses runCreateTourPostSubmitSuccess", denaliHook, /runCreateTourPostSubmitSuccess/);
assertMatch(
  "denali hook uses shared discard factory",
  denaliHook,
  /createCreateTourPostSubmitDiscardRemoteDraft/
);
assertMatch("denali hook passes discardRemoteDraft", denaliHook, /discardRemoteDraft/);
assertNoMatch("denali hook does not call draftSync.clearDraft on create success", denaliHook, /clearDraft:\s*\(\)\s*=>\s*draftSync\.clearDraft\(\)/);

assertMatch("photo bindings delegate to denali codec surface", photoBindings, /@app-tour\/workspace-denali\/ui\/adapters\/photo-upload-errors-surface/);
assertNoMatch("photo bindings have no duplicated alias table", photoBindings, /PHOTO_ERROR_CODE_ALIASES/);

assertMatch("workspace client uses runCreateTourPostSubmitSuccess", workspaceClient, /runCreateTourPostSubmitSuccess/);
assertMatch(
  "workspace client uses shared discard factory",
  workspaceClient,
  /createCreateTourPostSubmitDiscardRemoteDraft/
);
assertNoMatch("workspace client has no createCompleted workaround", workspaceClient, /createCompleted/);

assertNoMatch("denali core has no createCompleted workaround", denaliCore, /createCompleted/);
assertNoMatch("denali core onSubmit does not clear draft locally", denaliCore, /draftSync\.clearDraft\(\)/);

assertMatch("post-submit helper exposes discardRemoteDraft", postSubmit, /discardRemoteDraft/);
assertNoMatch("post-submit helper does not invoke engine clearDraft", postSubmit, /(?:void|await)\s+\w+\.clearDraft/);

assertMatch(
  "discard factory delegates to deleteWorkspaceDraftSnapshot",
  postSubmitDiscard,
  /deleteWorkspaceDraftSnapshot/
);
assertNoMatch("denali hook inlines deleteWorkspaceDraftSnapshot", denaliHook, /deleteWorkspaceDraftSnapshot/);
assertNoMatch(
  "workspace client inlines deleteWorkspaceDraftSnapshot",
  workspaceClient,
  /deleteWorkspaceDraftSnapshot/
);

console.log("guard-wizard-post-submit-contract: PASS");
