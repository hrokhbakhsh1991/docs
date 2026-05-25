import type { FieldPath } from "react-hook-form";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

import { DENALI_CANONICAL_TO_FORM_PATH_MAP } from "./generated/denaliCanonicalPathMap.generated";

/**
 * When no exact/longest-prefix match exists under a canonical root, map issues to the
 * same default fields as the legacy {@link canonicalZodPathToFormFieldPath} switch (values
 * are keys in {@link DENALI_CANONICAL_TO_FORM_PATH_MAP}, not hardcoded form paths).
 */
const CANONICAL_ROOT_DEFAULT_KEY: Readonly<Partial<Record<string, string>>> = {
  program: "program.themeIds",
  transport: "transport.mode",
  pricing: "pricing.paymentMode",
  participants: "participants.minimumAge",
  policies: "policies.policiesText",
};

function longestCanonicalMapKey(segments: readonly (string | number)[]): string | undefined {
  const parts = segments.map(String);
  for (let len = parts.length; len >= 1; len -= 1) {
    const key = parts.slice(0, len).join(".");
    if (Object.prototype.hasOwnProperty.call(DENALI_CANONICAL_TO_FORM_PATH_MAP, key)) {
      return key;
    }
  }
  return undefined;
}

function formPathWithSuffix(
  formBase: string,
  segments: readonly (string | number)[],
  matchedCanonicalKey: string,
): FieldPath<DenaliCreateTourWizardForm> {
  const prefixLen = matchedCanonicalKey.split(".").length;
  const suffixParts = segments.slice(prefixLen).map(String);
  if (suffixParts.length === 0) {
    return formBase as FieldPath<DenaliCreateTourWizardForm>;
  }
  return `${formBase}.${suffixParts.join(".")}` as FieldPath<DenaliCreateTourWizardForm>;
}

/**
 * Maps {@link denaliCanonicalTourSchema} issue paths → RHF paths using the registry-generated map.
 */
export function canonicalZodPathToFormFieldPath(
  path: readonly (string | number)[],
): FieldPath<DenaliCreateTourWizardForm> {
  if (path.length === 0) {
    const title = DENALI_CANONICAL_TO_FORM_PATH_MAP.title;
    return (title ?? "basicInfo.title") as FieldPath<DenaliCreateTourWizardForm>;
  }

  const exactKey = longestCanonicalMapKey(path);
  if (exactKey != null) {
    const formBase = DENALI_CANONICAL_TO_FORM_PATH_MAP[exactKey]!;
    return formPathWithSuffix(formBase, path, exactKey);
  }

  const head = String(path[0]);
  const rest = path.slice(1);
  const tail = rest.map(String).join(".");

  if (head === "program") {
    if (tail.startsWith("itinerary")) {
      const itineraryBase = DENALI_CANONICAL_TO_FORM_PATH_MAP["program.itinerary"];
      if (itineraryBase) {
        return formPathWithSuffix(itineraryBase, path, "program.itinerary");
      }
      return `programNature.${tail}` as FieldPath<DenaliCreateTourWizardForm>;
    }
    const defaultForm = DENALI_CANONICAL_TO_FORM_PATH_MAP["program.themeIds"];
    if (defaultForm) {
      return defaultForm as FieldPath<DenaliCreateTourWizardForm>;
    }
  }

  const defaultCanonical = CANONICAL_ROOT_DEFAULT_KEY[head];
  if (defaultCanonical != null) {
    const defaultForm = DENALI_CANONICAL_TO_FORM_PATH_MAP[defaultCanonical];
    if (defaultForm) {
      return defaultForm as FieldPath<DenaliCreateTourWizardForm>;
    }
  }

  return (tail.length > 0 ? `${head}.${tail}` : head) as FieldPath<DenaliCreateTourWizardForm>;
}
