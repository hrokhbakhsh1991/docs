/** Fixed Phase 0 gate scope — not read from process.env. */
export const FOUNDATION_LEGACY_SCAN_SCOPE = "foundation" as const;

export type FoundationLegacyScanScope = typeof FOUNDATION_LEGACY_SCAN_SCOPE | "monorepo";

/** Minimal child-process environment for isolated contract runs (UT-01). */
export function buildPhase0ChildEnv(
  scope: FoundationLegacyScanScope = FOUNDATION_LEGACY_SCAN_SCOPE,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    LEGACY_IMPORT_SCAN_SCOPE: scope,
  };
  if (process.env.PATH) {
    env.PATH = process.env.PATH;
  }
  return env;
}
