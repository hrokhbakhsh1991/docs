import {
  classifyPublicRegistrationMobileInput,
  normalizePublicRegistrationMobile,
} from "@app-tour/catalog-registration-auth";

export type DenaliRequiredIntakeCopyField =
  | "fullName"
  | "phone"
  | "email"
  | "fatherName"
  | "nationalId"
  | "birthDate"
  | "partySize";

export function denaliRequiredIntakeCopyField(fieldId: string): DenaliRequiredIntakeCopyField {
  switch (fieldId) {
    case "fullName":
      return "fullName";
    case "phone":
      return "phone";
    case "email":
      return "email";
    case "fatherName":
      return "fatherName";
    case "nationalId":
      return "nationalId";
    case "birthDate":
      return "birthDate";
    default:
      return "partySize";
  }
}

export function parseCatalogRegistrationResponseBody(
  text: string
): { readonly ok?: boolean; readonly code?: string } | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as { readonly ok?: boolean; readonly code?: string };
  } catch {
    return null;
  }
}

export function findDuplicateOtherGuestMobile(phones: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const raw of phones) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      continue;
    }
    if (classifyPublicRegistrationMobileInput(trimmed) !== null) {
      continue;
    }
    const normalized = normalizePublicRegistrationMobile(trimmed);
    if (seen.has(normalized)) {
      return normalized;
    }
    seen.add(normalized);
  }
  return null;
}
