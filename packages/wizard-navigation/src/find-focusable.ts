const FOCUSABLE_SELECTOR =
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

type FocusableElement = Element & {
  focus(options?: FocusOptions): void;
};

function isFocusableElement(node: unknown): node is FocusableElement {
  return (
    typeof node === "object" &&
    node !== null &&
    "focus" in node &&
    typeof (node as FocusableElement).focus === "function"
  );
}

function canReceiveFocus(element: Element): boolean {
  if (!isFocusableElement(element)) {
    return false;
  }
  if (element.hasAttribute("disabled")) {
    return false;
  }
  const tabIndex = element.getAttribute("tabindex");
  if (tabIndex === "-1") {
    return false;
  }
  return true;
}

export function findFocusableDescendant(container: Element): FocusableElement | null {
  if (canReceiveFocus(container) && isFocusableElement(container)) {
    return container;
  }
  const match = container.querySelector(FOCUSABLE_SELECTOR);
  if (match === null || !canReceiveFocus(match) || !isFocusableElement(match)) {
    return null;
  }
  return match;
}
