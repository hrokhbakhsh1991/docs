/** Host-injected destinations adapter — settings repo lives in apps/api. */
export interface DenaliPublicDestinationPort {
  getDestinationNamesByIds(
    tenantId: string,
    destinationIds: readonly string[]
  ): Promise<Readonly<Record<string, string>>>;
}
