export type BookingRegistrationSloPort = {
  readonly record: (input: {
    readonly workspaceType: string;
    readonly tenantId: string;
    readonly outcome: "success" | "error";
    readonly durationMs?: number;
  }) => void;
};
