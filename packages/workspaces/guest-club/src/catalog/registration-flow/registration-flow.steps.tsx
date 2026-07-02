import { mergeFlowState, transitionFlowStep, type RegistrationFlowStepProps } from "@app-tour/workspace-sdk";
import { type FormEvent, type JSX } from "react";

export function GuestClubIntakeStep({ state, dispatch }: RegistrationFlowStepProps): JSX.Element {
  const data = state.data as Readonly<Record<string, string>>;

  function update(fieldId: string, value: string): void {
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
          value={data.fullName ?? ""}
          onChange={(event) => update("fullName", event.currentTarget.value)}
        />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          value={data.email ?? ""}
          onChange={(event) => update("email", event.currentTarget.value)}
        />
      </label>
      <label>
        Party size
        <input
          name="partySize"
          type="number"
          min={1}
          value={data.partySize ?? "1"}
          onChange={(event) => update("partySize", event.currentTarget.value)}
        />
      </label>
      <button type="submit" data-action="intake-submit">Continue</button>
    </form>
  );
}

export function GuestClubDoneStep({ context }: RegistrationFlowStepProps): JSX.Element {
  return (
    <div data-public-registration-success data-guest-club-registration-success={true}>
      <p role="status">Registration received for {context.tourTitle}.</p>
      <p>
        <a href={context.backHref}>Back to tour</a>
      </p>
    </div>
  );
}
