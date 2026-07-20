/**
 * SK2 NotificationDeliveryPort — provider-agnostic delivery contract.
 * @see docs/phase-saas-kernel/appendices/SK2_NOTIFICATION_OUTBOX.md
 * @see docs/phase-saas-kernel/appendices/SK2_C_IMPLEMENTATION.md
 */

export type NotificationChannel = "email" | "sms" | "in_app";

export type NotificationCommand = {
  readonly tenantId: string;
  readonly channel: NotificationChannel;
  readonly templateId: string;
  readonly recipient: { readonly userId?: string; readonly address?: string };
  readonly payload: Readonly<Record<string, unknown>>;
  readonly correlationId: string;
};

export type NotificationDeliveryResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly retryable: boolean };

export interface NotificationDeliveryPort {
  deliver(command: NotificationCommand): Promise<NotificationDeliveryResult>;
}

export const NOTIFICATION_TENANT_REQUIRED = "NOTIFICATION_TENANT_REQUIRED";
export const NOTIFICATION_CORRELATION_REQUIRED = "NOTIFICATION_CORRELATION_REQUIRED";
