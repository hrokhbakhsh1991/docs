import { buildCreateTourSuccessRedirect } from "./create-tour-success-redirect";

export type CreateTourPostSubmitSuccessInput = {
  readonly tourId: string;
  readonly navigate: (url: string) => void;
  /** Fire-and-forget remote draft DELETE (non-verified) after navigation. */
  readonly discardRemoteDraft?: () => Promise<void>;
};

/** Redirect to tours list; optional background remote draft cleanup (no engine clearDraft). */
export function runCreateTourPostSubmitSuccess(input: CreateTourPostSubmitSuccessInput): void {
  input.navigate(buildCreateTourSuccessRedirect(input.tourId));
  if (input.discardRemoteDraft !== undefined) {
    void input.discardRemoteDraft();
  }
}
