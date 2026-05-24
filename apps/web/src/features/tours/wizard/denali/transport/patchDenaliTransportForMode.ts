import type { DenaliCanonicalTourModel } from "@repo/types/denali";
import {
  isDenaliOrganizedTransportWithPersonalCarOption,
  isDenaliTransportCostVisible,
  isDenaliTransportDongAmountVisible,
} from "@repo/types/denali";
import type { DenaliTransportMode } from "@repo/types";

/** Canonical transport patch when the user changes transport mode (clears incompatible fields). */
export function patchDenaliTransportForMode(
  current: DenaliCanonicalTourModel["transport"],
  mode: DenaliTransportMode,
): DenaliCanonicalTourModel["transport"] {
  const hasPersonalCarOption = isDenaliOrganizedTransportWithPersonalCarOption(mode);
  const allowPersonalCar = hasPersonalCarOption ? current.allowPersonalCar : undefined;
  const dongVisible = isDenaliTransportDongAmountVisible({ mode, allowPersonalCar });
  const costVisible = isDenaliTransportCostVisible(mode);

  return {
    ...current,
    mode,
    transportCost: costVisible ? current.transportCost : undefined,
    allowPersonalCar,
    dongAmount: dongVisible ? current.dongAmount : undefined,
  };
}
