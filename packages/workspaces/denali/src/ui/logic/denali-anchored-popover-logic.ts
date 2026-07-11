import {
  DEFAULT_DENALI_SEARCHABLE_SELECT_THRESHOLD,
  shouldUseDenaliSearchableSelect,
} from "./denali-searchable-select-logic";

/** Wizard mobile breakpoint — matches `wizard-skin.css` @media (max-width: 640px). */
export const DENALI_WIZARD_MOBILE_MAX_WIDTH_PX = 640;

export type DenaliAnchoredPopoverPlacement = {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly maxHeight: number;
};

export type ResolveDenaliAnchoredPopoverPlacementInput = {
  readonly triggerRect: Pick<DOMRect, "top" | "bottom" | "left" | "width">;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly gap?: number;
  readonly padding?: number;
  readonly maxPanelHeight?: number;
  readonly minPanelHeight?: number;
};

/** Viewport-anchored placement for wizard dropdown panels (mobile-safe). */
export function resolveDenaliAnchoredPopoverPlacement(
  input: ResolveDenaliAnchoredPopoverPlacementInput
): DenaliAnchoredPopoverPlacement {
  const gap = input.gap ?? 8;
  const padding = input.padding ?? 12;
  const minPanelHeight = input.minPanelHeight ?? 120;
  const maxPanelHeight =
    input.maxPanelHeight ?? Math.min(384, Math.floor(input.viewportHeight * 0.42));

  const width = Math.min(input.triggerRect.width, input.viewportWidth - padding * 2);
  const left = Math.min(
    Math.max(input.triggerRect.left, padding),
    input.viewportWidth - width - padding
  );

  const belowTop = input.triggerRect.bottom + gap;
  const spaceBelow = input.viewportHeight - belowTop - padding;
  const spaceAbove = input.triggerRect.top - gap - padding;
  const openBelow = spaceBelow >= minPanelHeight || spaceBelow >= spaceAbove;
  const maxHeight = Math.max(
    minPanelHeight,
    Math.min(maxPanelHeight, openBelow ? spaceBelow : spaceAbove)
  );
  const top = openBelow
    ? belowTop
    : Math.max(padding, input.triggerRect.top - gap - maxHeight);

  return { top, left, width, maxHeight };
}

/** Native `<select>` on narrow viewports mis-anchors; use custom portaled panel instead. */
export function shouldUseDenaliWizardCustomSelectPanel(
  optionCount: number,
  searchableThreshold: number = DEFAULT_DENALI_SEARCHABLE_SELECT_THRESHOLD,
  viewportWidth: number
): boolean {
  if (optionCount <= 0) {
    return false;
  }
  if (shouldUseDenaliSearchableSelect(optionCount, searchableThreshold)) {
    return true;
  }
  return viewportWidth <= DENALI_WIZARD_MOBILE_MAX_WIDTH_PX;
}
