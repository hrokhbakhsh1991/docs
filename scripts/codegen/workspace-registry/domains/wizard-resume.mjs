import { BANNER } from "../constants.mjs";
import { expandAuthorManifest, loadProfileCatalog } from "./profile-expansion.mjs";

/**
 * Resolve effective wizardResume block from manifest (author or profile-expanded).
 *
 * @param {Record<string, unknown>} manifest
 */
export function resolveWizardResumeManifest(manifest) {
  return manifest.wizardResume;
}

/**
 * @param {Record<string, unknown>} manifest
 */
export function assertWizardResumeManifest(manifest) {
  const block = resolveWizardResumeManifest(manifest);
  if (block === undefined) {
    return;
  }
  if (typeof block !== "object" || block === null || Array.isArray(block)) {
    throw new Error(`workspace.manifest.json ${manifest.id}: wizardResume must be an object`);
  }
  const mode = block.mode;
  if (mode === "noop" || mode === "generic") {
    return;
  }
  if (mode === "module") {
    for (const key of ["module", "export"]) {
      if (typeof block[key] !== "string" || block[key].trim().length === 0) {
        throw new Error(`workspace.manifest.json ${manifest.id}: wizardResume.${key} is required`);
      }
    }
    return;
  }
  throw new Error(
    `workspace.manifest.json ${manifest.id}: wizardResume.mode must be noop, generic, or module`
  );
}

/**
 * @param {readonly Record<string, unknown>[]} authorManifests
 */
export function generateWorkspaceWizardResumeAudit(authorManifests) {
  const catalog = loadProfileCatalog();
  /** @type {string[]} */
  const auditEntries = [];

  for (const author of authorManifests) {
    const { effective } = expandAuthorManifest(author, catalog);
    assertWizardResumeManifest(effective);
    const block = resolveWizardResumeManifest(effective);
    if (block === undefined) {
      auditEntries.push(`  ${JSON.stringify(author.id)}: null,`);
      continue;
    }
    if (block.mode === "noop" || block.mode === "generic") {
      auditEntries.push(
        `  ${JSON.stringify(author.id)}: { mode: ${JSON.stringify(block.mode)} },`
      );
      continue;
    }
    auditEntries.push(`  ${JSON.stringify(author.id)}: {
    mode: "module",
    module: ${JSON.stringify(block.module)},
    export: ${JSON.stringify(block.export)},
  },`);
  }

  if (auditEntries.length === 0) {
    return `${BANNER}
export type WorkspaceWizardResumeAuditEntry =
  | { readonly mode: "noop" }
  | { readonly mode: "generic" }
  | { readonly mode: "module"; readonly module: string; readonly export: string };

export const WORKSPACE_WIZARD_RESUME_AUDIT = {} as const satisfies Record<
  string,
  WorkspaceWizardResumeAuditEntry | null
>;
`;
  }

  return `${BANNER}
export type WorkspaceWizardResumeAuditEntry =
  | { readonly mode: "noop" }
  | { readonly mode: "generic" }
  | { readonly mode: "module"; readonly module: string; readonly export: string };

/** Manifest-declared wizard resume placement — DEC-CW-05 Option C inspectability. */
export const WORKSPACE_WIZARD_RESUME_AUDIT = {
${auditEntries.join("\n")}
} as const satisfies Record<string, WorkspaceWizardResumeAuditEntry | null>;
`;
}
