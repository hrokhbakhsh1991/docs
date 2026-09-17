export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type BusinessHoursWindow = {
  readonly start: string;
  readonly end: string;
};

export type BusinessHoursConfig = {
  readonly timezone: string;
  readonly weekly: Readonly<Record<WeekdayKey, readonly BusinessHoursWindow[]>>;
};

export type SlaEscalationStep = {
  readonly level: number;
  readonly afterMinutes: number;
  readonly action: "notify_team" | "bump_priority";
  readonly teamId?: string | null;
  readonly priority?: string | null;
};

export type SlaPolicyShape = {
  readonly id: string;
  readonly code: string;
  readonly workspaceType: string | null;
  readonly categoryCode: string | null;
  readonly priority: string | null;
  readonly queueId: string | null;
  readonly firstResponseMinutes: number;
  readonly nextResponseMinutes: number;
  readonly resolutionMinutes: number;
  readonly businessHours: BusinessHoursConfig;
  readonly escalationSteps: readonly SlaEscalationStep[];
  readonly warningThresholdPercent: number;
  readonly enabled: boolean;
};

export const DEFAULT_TICKETING_SLA_TIMEZONE = "Asia/Tehran" as const;

export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  timezone: DEFAULT_TICKETING_SLA_TIMEZONE,
  weekly: {
    mon: [{ start: "09:00", end: "17:00" }],
    tue: [{ start: "09:00", end: "17:00" }],
    wed: [{ start: "09:00", end: "17:00" }],
    thu: [{ start: "09:00", end: "17:00" }],
    fri: [{ start: "09:00", end: "17:00" }],
    sat: [],
    sun: [],
  },
};

export type TicketSlaClockSnapshot = {
  readonly policyId: string;
  readonly firstResponseDueAt: string | null;
  readonly nextResponseDueAt: string | null;
  readonly resolutionDueAt: string | null;
  readonly firstRespondedAt: string | null;
  readonly lastMemberMessageAt: string | null;
  readonly breachedAt: string | null;
  readonly escalationLevel: number;
  readonly pausedAt: string | null;
  readonly pausedMs: number;
};

export type RecalculateTicketSlaInput = {
  readonly policy: SlaPolicyShape;
  readonly ticketCreatedAt: string;
  readonly ticketStatus: string;
  readonly firstRespondedAt: string | null;
  readonly lastMemberMessageAt: string | null;
  readonly pausedAt: string | null;
  readonly pausedMs: number;
  readonly nowIso: string;
};
