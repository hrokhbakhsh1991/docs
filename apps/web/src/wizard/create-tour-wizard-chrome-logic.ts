/** Pure chrome decisions for create-tour wizard (no React / next-intl). */

export function shouldShowWizardTemplateSeedBanner(input: {
  readonly seedLabel: string;
  readonly draftTitle?: string;
}): boolean {
  const seed = input.seedLabel.trim();
  if (seed.length === 0) {
    return false;
  }
  const draftTitle = input.draftTitle?.trim() ?? "";
  if (draftTitle.length > 0 && draftTitle !== seed) {
    return false;
  }
  return true;
}

export function resolveCreateTourSubmitButtonKind(input: {
  readonly createdTourId: string | null | undefined;
  readonly pending: boolean;
}): "creating" | "createButton" {
  const created =
    input.createdTourId != null && input.createdTourId.trim().length > 0;
  if (created) {
    return "createButton";
  }
  return input.pending ? "creating" : "createButton";
}

export function isCreateTourSubmitDisabled(input: {
  readonly createdTourId: string | null | undefined;
  readonly pending: boolean;
}): boolean {
  const created =
    input.createdTourId != null && input.createdTourId.trim().length > 0;
  return input.pending || created;
}
