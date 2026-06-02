import type { UseFormSetValue } from "react-hook-form";

import type { RegistrationIntakeFormValues } from "./buildRegistrationIntakeSchema";

/** Clears private-car intake fields so group-only tours do not submit stale data. */
export function clearPrivateCarFields(
  setValue: UseFormSetValue<RegistrationIntakeFormValues>,
): void {
  setValue("isDriver", undefined, { shouldValidate: true });
  setValue("plateNumber", undefined, { shouldValidate: true });
  setValue("vehicleSeatCapacity", undefined, { shouldValidate: true });
  setValue("shareFuelCost", undefined, { shouldValidate: true });
}
