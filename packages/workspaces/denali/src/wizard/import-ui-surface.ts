/**
 * Opaque dynamic import for `src/ui/*`.
 * The specifier must be a `string` (not a literal import type) so plugin tsc
 * with `moduleResolution: Node` does not typecheck CSS/React pickers.
 * See docs/dev/localized-calendar.mdoc.
 */
import { resolveImportUiSurfaceLoader } from "./import-ui-surface.loaders";

export type UiSurfaceModule = {
  readonly [exportName: string]: any;
};

export function importUiSurface(specifier: string): Promise<UiSurfaceModule> {
  return resolveImportUiSurfaceLoader(specifier)();
}
