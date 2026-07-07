export type DenaliReminderFeedItem = {
  readonly activationId: string;
  readonly tourId: string;
  readonly reminderOffset: string;
  readonly anchorAt: string;
  readonly activatedAt: string;
};

/** Host-injected reminder activation read port — implemented in apps/api. */
export interface DenaliReminderFeedPort {
  listDueActivations(input: {
    readonly tenantId: string;
    readonly limit?: number;
  }): Promise<readonly DenaliReminderFeedItem[]>;
}
