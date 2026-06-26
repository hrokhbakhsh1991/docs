/** Atomic operation a provider adapter may expose. */
export type IntegrationCapability =
  | "message.send"
  | "channel.create"
  | "message.delete"
  | "group.manage";

export const INTEGRATION_CAPABILITIES = [
  "message.send",
  "channel.create",
  "message.delete",
  "group.manage",
] as const satisfies readonly IntegrationCapability[];

export function isIntegrationCapability(value: string): value is IntegrationCapability {
  return (INTEGRATION_CAPABILITIES as readonly string[]).includes(value);
}
