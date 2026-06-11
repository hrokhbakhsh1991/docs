import { cssEscapeAttributeValue } from "./css-escape";
import type { FieldFocusRegistry } from "./types";
import { WIZARD_FIELD_ID_ATTR, WIZARD_FIELD_PATH_ATTR } from "./types";

export function createDefaultFieldFocusRegistry(): FieldFocusRegistry {
  return {
    resolveSelectors(path: string): readonly string[] {
      const escaped = cssEscapeAttributeValue(path);
      return [
        `[${WIZARD_FIELD_PATH_ATTR}="${escaped}"]`,
        `[${WIZARD_FIELD_ID_ATTR}="${escaped}"]`,
        `[name="${escaped}"]`,
      ];
    },
  };
}
