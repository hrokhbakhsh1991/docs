import type { DenaliLocationDataForm } from "@/features/tours/wizard/schemas/denaliLocationDataSchema";

export const EMPTY_DENALI_LOCATION: DenaliLocationDataForm = {
  addressText: "",
  latitude: null,
  longitude: null,
};

export function hasDenaliLocationCoordinates(value: DenaliLocationDataForm): boolean {
  return (
    typeof value.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude)
  );
}

export function denaliLocationCoordinateErrorMessage(
  errors:
    | {
        latitude?: { message?: string };
        longitude?: { message?: string };
      }
    | undefined,
): string | undefined {
  return errors?.latitude?.message ?? errors?.longitude?.message;
}

export function denaliLocationDataOrEmpty(
  value: DenaliLocationDataForm | undefined,
): DenaliLocationDataForm {
  return value ?? EMPTY_DENALI_LOCATION;
}

export function denaliLocationDataIsEmpty(value: DenaliLocationDataForm | undefined): boolean {
  if (!value) return true;
  const text = value.addressText?.trim();
  return !text && value.latitude == null && value.longitude == null;
}
