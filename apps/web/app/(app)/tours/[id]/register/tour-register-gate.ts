import { resolveTourRegisterPageState } from "@/features/tours/tour-register-logic";
import type { TourUiStatus } from "@/features/tours/operator-tours-types";

export function resolveTourRegisterGateState(input: {
  readonly canManage: boolean;
  readonly loadingTour: boolean;
  readonly submitting: boolean;
  readonly error: string | null;
  readonly tourNotFound: boolean;
  readonly tourUiStatus?: TourUiStatus;
}) {
  return resolveTourRegisterPageState(input);
}
