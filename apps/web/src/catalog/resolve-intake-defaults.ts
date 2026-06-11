export type IntakeDefaultsInput = {
  readonly profileDisplayName?: string;
  readonly profileEmail?: string;
  readonly sessionDisplayName?: string;
  readonly sessionEmail?: string | null;
};

export function resolveIntakeDefaults(input: IntakeDefaultsInput): {
  readonly name: string;
  readonly email: string;
} {
  const profileName = input.profileDisplayName?.trim() ?? "";
  const sessionName = input.sessionDisplayName?.trim() ?? "";
  const profileEmail = input.profileEmail?.trim() ?? "";
  const sessionEmail = input.sessionEmail?.trim() ?? "";

  return {
    name: profileName.length > 0 ? profileName : sessionName,
    email: profileEmail.length > 0 ? profileEmail : sessionEmail,
  };
}
