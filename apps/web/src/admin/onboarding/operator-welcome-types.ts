export const OPERATOR_WELCOME_TEST_IDS = {
  dialog: "operator-welcome-dialog",
  brandMark: "operator-welcome-brand-mark",
  title: "operator-welcome-title",
  primaryCta: "operator-welcome-primary-cta",
  dismissCta: "operator-welcome-dismiss-cta",
} as const;

export type OperatorWelcomeBullet = {
  readonly id: string;
};

export type OperatorWelcomeContent = {
  readonly active: boolean;
  readonly bullets: readonly OperatorWelcomeBullet[];
};
