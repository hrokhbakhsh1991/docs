/** Horizontal scroll overflow edges for wizard step pill rails (LTR + RTL). */
export function readWizardStepRailOverflowEdges(element: HTMLElement): {
  readonly start: boolean;
  readonly end: boolean;
} {
  const maxScroll = element.scrollWidth - element.clientWidth;
  if (maxScroll <= 1) {
    return { start: false, end: false };
  }

  const rtl = getComputedStyle(element).direction === "rtl";
  const scrollOffset = Math.abs(element.scrollLeft);
  const epsilon = 2;

  if (rtl) {
    return {
      start: scrollOffset > epsilon,
      end: scrollOffset + element.clientWidth < element.scrollWidth - epsilon,
    };
  }

  return {
    start: element.scrollLeft > epsilon,
    end: element.scrollLeft + element.clientWidth < element.scrollWidth - epsilon,
  };
}

export function scrollWizardStepRailItemIntoView(
  item: HTMLElement,
  options?: { readonly behavior?: ScrollBehavior }
): void {
  item.scrollIntoView({
    behavior: options?.behavior ?? "smooth",
    block: "nearest",
    inline: "center",
  });
}
