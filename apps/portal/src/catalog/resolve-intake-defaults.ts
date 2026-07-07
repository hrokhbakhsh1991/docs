import type { PublicCatalogTransportSnapshot } from "@app-tour/workspace-sdk";

export type PortalCatalogTourContext = {
  readonly id: string;
  readonly title: string;
  readonly policiesText?: string | null;
  readonly nationalIdRequired?: boolean;
  readonly fatherNameRequired?: boolean;
  readonly birthDateRequired?: boolean;
  readonly priceAmount?: number | null;
  readonly transport?: PublicCatalogTransportSnapshot;
};

export type SessionProfileSnapshot = {
  readonly displayName: string;
  readonly email: string;
  readonly nationalId: string;
  readonly fatherName: string;
  readonly birthDate: string;
};

export type IntakeDefaultsInput = {
  readonly profileDisplayName?: string;
  readonly sessionDisplayName?: string;
  readonly sessionNationalId?: string | null;
  readonly sessionFatherName?: string | null;
  readonly sessionBirthDate?: string | null;
  readonly registrantTarget?: "self" | "other";
};

export function resolveIntakeDefaults(input: IntakeDefaultsInput): {
  readonly name: string;
  readonly nationalId: string;
  readonly fatherName: string;
  readonly birthDate: string;
} {
  if (input.registrantTarget === "other") {
    return { name: "", nationalId: "", fatherName: "", birthDate: "" };
  }

  const profileName = input.profileDisplayName?.trim() ?? "";
  const sessionName = input.sessionDisplayName?.trim() ?? "";
  const sessionNationalId = input.sessionNationalId?.trim() ?? "";
  const sessionFatherName = input.sessionFatherName?.trim() ?? "";
  const sessionBirthDate = input.sessionBirthDate?.trim() ?? "";

  return {
    name: profileName.length > 0 ? profileName : sessionName,
    nationalId: sessionNationalId,
    fatherName: sessionFatherName,
    birthDate: sessionBirthDate,
  };
}

export function hasKnownIntakeName(name: string): boolean {
  return name.trim().length > 0;
}

export function emptySessionProfileSnapshot(): SessionProfileSnapshot {
  return {
    displayName: "",
    email: "",
    nationalId: "",
    fatherName: "",
    birthDate: "",
  };
}
