import { cssEscapeAttributeValue } from "./css-escape";
import type { FieldFocusRegistry } from "./types";
import { WIZARD_FIELD_ID_ATTR, WIZARD_FIELD_PATH_ATTR } from "./types";

export type WaitForWizardFieldOptions = {
  readonly root?: ParentNode | null;
  readonly timeoutMs?: number;
  readonly intervalMs?: number;
};

function resolveRoot(options?: WaitForWizardFieldOptions): ParentNode | null {
  if (options?.root !== undefined) {
    return options.root;
  }
  if (typeof document !== "undefined") {
    return document;
  }
  return null;
}

function findFieldMarker(
  root: ParentNode,
  registry: FieldFocusRegistry,
  path: string
): Element | null {
  for (const selector of registry.resolveSelectors(path)) {
    const match = root.querySelector(selector);
    if (match !== null) {
      return match;
    }
  }
  const escaped = cssEscapeAttributeValue(path);
  return root.querySelector(`[${WIZARD_FIELD_PATH_ATTR}="${escaped}"]`);
}

/** Poll until a field marker appears (e.g. after async step panel swap). */
export async function waitForWizardFieldMarker(
  path: string,
  registry: FieldFocusRegistry,
  options?: WaitForWizardFieldOptions
): Promise<Element | null> {
  const root = resolveRoot(options);
  if (root === null) {
    return null;
  }

  const timeoutMs = options?.timeoutMs ?? 2_500;
  const intervalMs = options?.intervalMs ?? 50;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const match = findFieldMarker(root, registry, path);
    if (match !== null) {
      return match;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }

  return findFieldMarker(root, registry, path);
}
