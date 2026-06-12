export const WIZARD_FIELD_VALIDATION_HIGHLIGHT_CLASS = "wizard-field--validation-highlight" as const;

type HighlightableElement = {
  classList: {
    add: (className: string) => void;
    remove: (className: string) => void;
  };
};

function asHighlightableElement(value: unknown): HighlightableElement | null {
  if (typeof value !== "object" || value === null || !("classList" in value)) {
    return null;
  }
  const classList = (value as HighlightableElement).classList;
  if (
    typeof classList?.add !== "function" ||
    typeof classList?.remove !== "function"
  ) {
    return null;
  }
  return value as HighlightableElement;
}

export function highlightWizardFieldMarker(element: unknown, durationMs = 2_400): void {
  const highlightable = asHighlightableElement(element);
  if (highlightable === null) {
    return;
  }
  highlightable.classList.add(WIZARD_FIELD_VALIDATION_HIGHLIGHT_CLASS);
  const clearHighlight = () => {
    highlightable.classList.remove(WIZARD_FIELD_VALIDATION_HIGHLIGHT_CLASS);
  };
  if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
    window.setTimeout(clearHighlight, durationMs);
    return;
  }
  clearHighlight();
}
