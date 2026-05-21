import { useCallback } from "react";
import { useFormContext } from "react-hook-form";

import type { TourCreateFormValues } from "../schemas/tourCreateSchema";

/**
 * Hook that isolates all RHF interactions needed by ReviewSubmitStep.
 * Returns only the data slices the UI needs plus a submit handler.
 * Keeps the component free of direct RHF calls.
 */
export function useReviewSubmitRHF() {
  const {
    control,
    formState: { errors },
    setError,
    clearErrors,
  } = useFormContext<TourCreateFormValues>();

  // Pull the individual fields we need – using `useWatch` inside the component
  // is fine because this hook is called at the top level of the step.
  const autoAcceptRegistrations = control._formValues.autoAcceptRegistrations;
  const overview = control._formValues.overview;
  const pricing = control._formValues.pricing;
  const schedule = control._formValues.schedule;
  const location = control._formValues.location;
  const itinerary = control._formValues.itinerary;
  const participation = control._formValues.participation;
  const logistics = control._formValues.logistics;
  const policies = control._formValues.policies;

  const onSubmit = useCallback(
    async (payload: unknown) => {
      // The actual submit implementation lives elsewhere (wizard engine).
      // Here we just forward the payload to the parent via the form's native submit.
      // The parent component can call `handleSubmit` with this callback.
      // For now we simply resolve – real logic will be injected by the wizard engine.
      void payload;
      await Promise.resolve();
    },
    [],
  );

  // Expose a simple error object for UI rendering.
  const submitError = errors?.root?.message ? new Error(errors.root.message) : undefined;

  return {
    autoAcceptRegistrations,
    overview,
    pricing,
    schedule,
    location,
    itinerary,
    participation,
    logistics,
    policies,
    onSubmit,
    submitError,
    // expose RHF utilities if needed by future extensions
    setError,
    clearErrors,
  };
}
