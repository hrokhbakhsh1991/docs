"use client";

import { readCatalogRegistrationFlowState } from "@app-tour/catalog-registration-auth";
import {
  mergeFlowState,
  transitionFlowStep,
  type RegistrationFlowStepProps,
} from "@app-tour/workspace-sdk";
import { useState, type FormEvent, type JSX } from "react";

export function HarborIntakeStep({
  context,
  state,
  dispatch,
  resolveError,
}: RegistrationFlowStepProps): JSX.Element {
  const data = readCatalogRegistrationFlowState(state.data);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(fieldId: string, value: string): void {
    if (fieldId === "fullName") {
      mergeFlowState(state, dispatch, { intakeName: value });
      return;
    }
    if (fieldId === "email") {
      mergeFlowState(state, dispatch, { intakeEmail: value });
      return;
    }
    mergeFlowState(state, dispatch, { [fieldId]: value } as Partial<typeof data>);
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const fullName = data.intakeName.trim();
    const email = data.intakeEmail.trim();
    const partySize = Number.parseInt(data.partySize.replace(/\D/g, ""), 10);
    if (fullName.length === 0) {
      setError("Full name is required");
      return;
    }
    if (email.length === 0) {
      setError("Email is required");
      return;
    }
    if (!Number.isFinite(partySize) || partySize < 1) {
      setError("Party size is invalid");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/catalog/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tourId: context.tourId,
          fullName,
          partySize,
          registrantTarget: "self",
          ...(data.phone.length > 0 ? { phone: data.phone } : {}),
          email,
          ...(data.notes.trim().length > 0 ? { notes: data.notes.trim() } : {}),
        }),
      });
      const result = (await res.json()) as { ok?: boolean; code?: string };
      if (!res.ok || !result.ok) {
        setError(resolveError(typeof result.code === "string" ? result.code : "network"));
        return;
      }
      transitionFlowStep(dispatch, "done");
    } catch {
      setError(resolveError("network"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} data-public-registration-intake data-tour-id={context.tourId}>
      <label>
        Full name
        <input
          name="fullName"
          data-intake-field="fullName"
          value={data.intakeName}
          onChange={(event) => updateField("fullName", event.currentTarget.value)}
        />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          data-intake-field="email"
          value={data.intakeEmail}
          onChange={(event) => updateField("email", event.currentTarget.value)}
        />
      </label>
      <label>
        Party size
        <input
          name="partySize"
          type="number"
          min={1}
          data-intake-field="partySize"
          value={data.partySize}
          onChange={(event) => updateField("partySize", event.currentTarget.value)}
        />
      </label>
      {error !== null ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={loading} data-action="intake-submit">
        {loading ? "Submitting…" : "Continue"}
      </button>
    </form>
  );
}

export function HarborDoneStep({ context }: RegistrationFlowStepProps): JSX.Element {
  return (
    <div data-public-registration-success data-harbor-registration-success={true}>
      <p role="status">Registration received for {context.tourTitle}.</p>
      <p>
        <a href={context.backHref}>Back to tour</a>
      </p>
    </div>
  );
}
