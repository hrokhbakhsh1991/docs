import { readCatalogRegistrationFlowState } from "@app-tour/catalog-registration-auth";
import { mergeFlowState, transitionFlowStep, type RegistrationFlowStepProps } from "@app-tour/workspace-sdk";
import { type FormEvent, type JSX } from "react";

export function CertClubIntakeStep({ state, dispatch }: RegistrationFlowStepProps): JSX.Element {
  const data = readCatalogRegistrationFlowState(state.data);

  function update(fieldId: string, value: string): void {
    if (fieldId === "fullName") {
      mergeFlowState(state, dispatch, { intakeName: value });
      return;
    }
    if (fieldId === "email") {
      mergeFlowState(state, dispatch, { intakeEmail: value });
      return;
    }
    mergeFlowState(state, dispatch, { [fieldId]: value });
  }

  function submit(event: FormEvent): void {
    event.preventDefault();
    transitionFlowStep(dispatch, "done");
  }

  return (
    <form onSubmit={submit} data-public-registration-intake>
      <label>
        Full name
        <input
          name="fullName"
          data-intake-field="fullName"
          value={data.intakeName}
          onChange={(event) => update("fullName", event.currentTarget.value)}
        />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          data-intake-field="email"
          value={data.intakeEmail}
          onChange={(event) => update("email", event.currentTarget.value)}
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
          onChange={(event) => update("partySize", event.currentTarget.value)}
        />
      </label>
      <button type="submit" data-action="intake-submit">Continue</button>
    </form>
  );
}

export function CertClubDoneStep({ context }: RegistrationFlowStepProps): JSX.Element {
  return (
    <div data-public-registration-success data-cert-club-registration-success={true}>
      <p role="status">Registration received for {context.tourTitle}.</p>
      <p>
        <a href={context.backHref}>Back to tour</a>
      </p>
    </div>
  );
}
