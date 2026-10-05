/**
 * Keeps the active item of an overflow-x rail discoverable without changing
 * the page's vertical scroll position. Used by tabs and wizard step rails.
 */
export function scrollHorizontalItemIntoView(
  item: HTMLElement,
  options?: { readonly behavior?: ScrollBehavior }
): void {
  item.scrollIntoView({
    behavior: options?.behavior ?? "smooth",
    block: "nearest",
    inline: "center",
  });
}
