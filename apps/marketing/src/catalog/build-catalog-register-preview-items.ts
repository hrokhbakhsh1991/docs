import { isPublicCatalogOrganizedTransportMode } from "@app-tour/workspace-sdk";

import type { MarketingCatalogCard } from "./catalog-types";

export type CatalogRegisterPreviewItem = {
  readonly id: string;
  readonly text: string;
};

export type BuildCatalogRegisterPreviewItemsInput = {
  readonly tour: MarketingCatalogCard;
  readonly labels: {
    readonly nationalId: string;
    readonly fatherName: string;
    readonly birthDate: string;
    readonly minimumAge: (years: number) => string;
    readonly maximumAge: (years: number) => string;
    readonly transportIntake: string;
    readonly payment: (modeLabel: string) => string;
  };
  readonly paymentModeLabel: string | null;
};

/** PR-D5 intake preview lines — card flags only; no admin/API changes. */
export function buildCatalogRegisterPreviewItems(
  input: BuildCatalogRegisterPreviewItemsInput,
): readonly CatalogRegisterPreviewItem[] {
  const { tour, labels } = input;
  const items: CatalogRegisterPreviewItem[] = [];

  if (tour.nationalIdRequired === true) {
    items.push({ id: "national-id", text: labels.nationalId });
  }
  if (tour.fatherNameRequired === true) {
    items.push({ id: "father-name", text: labels.fatherName });
  }
  if (tour.birthDateRequired === true) {
    items.push({ id: "birth-date", text: labels.birthDate });
  }
  if (tour.minimumAge != null && Number.isFinite(tour.minimumAge)) {
    items.push({
      id: "minimum-age",
      text: labels.minimumAge(Math.trunc(tour.minimumAge)),
    });
  }
  if (tour.maximumAge != null && Number.isFinite(tour.maximumAge)) {
    items.push({
      id: "maximum-age",
      text: labels.maximumAge(Math.trunc(tour.maximumAge)),
    });
  }

  const transportMode = tour.transport?.mode;
  if (transportMode != null && isPublicCatalogOrganizedTransportMode(transportMode)) {
    items.push({ id: "transport-intake", text: labels.transportIntake });
  }

  const paymentMode = tour.paymentMode?.trim() ?? "";
  if (paymentMode.length > 0 && input.paymentModeLabel != null) {
    items.push({
      id: "payment-mode",
      text: labels.payment(input.paymentModeLabel),
    });
  }

  return Object.freeze(items);
}

export function tourHasRegisterPreviewData(tour: MarketingCatalogCard): boolean {
  return buildCatalogRegisterPreviewItems({
    tour,
    labels: {
      nationalId: "",
      fatherName: "",
      birthDate: "",
      minimumAge: () => "",
      maximumAge: () => "",
      transportIntake: "",
      payment: () => "",
    },
    paymentModeLabel: tour.paymentMode?.trim() ? tour.paymentMode.trim() : null,
  }).length > 0;
}
