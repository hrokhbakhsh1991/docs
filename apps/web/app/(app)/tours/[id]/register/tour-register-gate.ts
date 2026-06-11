import { resolveTourRegisterPageState } from "@/features/tours/tour-register-logic";

export function resolveTourRegisterGateState(input: {
  readonly canManage: boolean;
  readonly loadingTour: boolean;
  readonly submitting: boolean;
  readonly error: string | null;
  readonly tourNotFound: boolean;
}) {
  return resolveTourRegisterPageState(input);
}
