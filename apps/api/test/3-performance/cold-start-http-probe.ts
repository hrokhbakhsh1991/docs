/**
 * Lazy validation handler for cold-start-http-worker (CS-UNSC-02).
 * Imported only on first GET /probe — keeps worker spawn-to-ready off platform-core graph.
 */
import { performance } from "node:perf_hooks";

export async function runColdStartHttpProbe(
  cellCount: number,
  tenantId: string
): Promise<{ readonly initMs: number; readonly ok: boolean }> {
  const started = performance.now();
  const [{ PlatformWizardEngine }, { createCanonicalDocument }, fixtures] = await Promise.all([
    import("@app-tour/platform-core"),
    import("@app-tour/workspace-sdk/canonical"),
    import("./cold-start-fixtures"),
  ]);

  const largePlugin = fixtures.buildLargeWorkspacePlugin(cellCount);
  const engine = PlatformWizardEngine.create(largePlugin);
  const document = createCanonicalDocument(fixtures.COLD_START_CANONICAL_INPUT);
  const result = engine.validateCanonical(document, {
    tenantId,
    dimensions: { variant: "default" },
  });

  return { initMs: performance.now() - started, ok: result.ok };
}
