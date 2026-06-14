import { DENALI_COMPOSITE_BY_CANONICAL_PATH } from "@app-tour/workspace-denali/composites";
import {
  createDefaultFieldFocusRegistry,
  type FieldFocusRegistry,
} from "@app-tour/wizard-navigation";

function compositeIdToFocusTestId(compositeId: string): string {
  return `denali-composite-${compositeId.replace(/^denali\./, "").replace(/\./g, "-")}`;
}

/** Denali wizard focus registry — canonical paths plus composite widget test ids. */
export function createDenaliFieldFocusRegistry(): FieldFocusRegistry {
  const base = createDefaultFieldFocusRegistry();

  return {
    resolveSelectors(path: string): readonly string[] {
      const selectors = [...base.resolveSelectors(path)];

      if (path.startsWith("denali.")) {
        selectors.push(`[data-testid="${compositeIdToFocusTestId(path)}"]`);
      }

      const compositeId = DENALI_COMPOSITE_BY_CANONICAL_PATH[path];
      if (compositeId != null) {
        selectors.push(`[data-testid="${compositeIdToFocusTestId(compositeId)}"]`);
      }

      return selectors;
    },
  };
}
