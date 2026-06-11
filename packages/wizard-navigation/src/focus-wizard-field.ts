import { findFocusableDescendant } from "./find-focusable";
import type { FieldFocusRegistry, FocusWizardFieldOptions } from "./types";

function resolveRoot(options?: FocusWizardFieldOptions): ParentNode | null {
  if (options?.root !== undefined) {
    return options.root;
  }
  if (typeof document !== "undefined") {
    return document;
  }
  return null;
}

export function focusWizardField(
  path: string,
  registry: FieldFocusRegistry,
  options?: FocusWizardFieldOptions
): boolean {
  const root = resolveRoot(options);
  if (root === null) {
    return false;
  }

  for (const selector of registry.resolveSelectors(path)) {
    const match = root.querySelector(selector);
    if (match === null) {
      continue;
    }
    const focusable = findFocusableDescendant(match);
    if (focusable === null) {
      continue;
    }
    focusable.focus({ preventScroll: options?.scroll === false });
    if (options?.scroll !== false) {
      focusable.scrollIntoView({
        behavior: options?.scrollBehavior ?? "smooth",
        block: "nearest",
      });
    }
    return true;
  }

  return false;
}
