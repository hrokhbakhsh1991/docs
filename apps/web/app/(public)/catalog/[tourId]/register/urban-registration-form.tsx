"use client";

import { Input } from "@app-tour/ui-primitives/input";
import { useActionState } from "react";

import {
  submitUrbanRegistrationAction,
  type SubmitUrbanRegistrationResult,
} from "@/urban/submit-urban-registration.server";

type FormProps = {
  readonly tenantId: string;
  readonly tourId: string;
  readonly submitted?: boolean;
};

async function registrationAction(
  _prev: SubmitUrbanRegistrationResult | null,
  formData: FormData
): Promise<SubmitUrbanRegistrationResult> {
  const email = String(formData.get("email") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const partySizeRaw = String(formData.get("partySize") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const tenantId = String(formData.get("tenantId") ?? "");
  const tourId = String(formData.get("tourId") ?? "");

  return submitUrbanRegistrationAction({
    tenantId,
    tourId,
    email,
    fullName,
    ...(phone ? { phone } : {}),
    ...(partySizeRaw ? { partySize: Number.parseInt(partySizeRaw, 10) } : {}),
    ...(notes ? { notes } : {}),
  });
}

export function UrbanRegistrationForm({ tenantId, tourId, submitted }: FormProps) {
  const [state, formAction, pending] = useActionState(registrationAction, null);

  if (submitted || state?.ok === true) {
    return (
      <p role="status" data-urban-registration-success>
        Registration received. Thank you!
      </p>
    );
  }

  return (
    <form action={formAction} data-urban-registration-form>
      <Input type="hidden" name="tenantId" value={tenantId} />
      <Input type="hidden" name="tourId" value={tourId} />
      <label>
        Email
        <Input name="email" type="email" required maxLength={320} />
      </label>
      <label>
        Full name
        <Input name="fullName" type="text" required maxLength={200} />
      </label>
      <label>
        Phone (optional)
        <Input name="phone" type="tel" maxLength={32} />
      </label>
      <label>
        Party size (optional)
        <Input name="partySize" type="number" min={1} />
      </label>
      <label>
        Notes (optional)
        <textarea name="notes" maxLength={2000} />
      </label>
      {state?.ok === false ? (
        <p role="alert" data-urban-registration-error data-code={state.code}>
          Registration failed ({state.code}).
        </p>
      ) : null}
      <button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit registration"}
      </button>
    </form>
  );
}
