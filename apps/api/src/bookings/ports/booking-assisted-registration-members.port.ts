export type AssistedRegistrationMemberSnapshot = {
  readonly userId: string;
  readonly status: "ACTIVE" | "INVITED" | "SUSPENDED";
};

export interface BookingAssistedRegistrationMembersPort {
  findTenantMember(
    tenantId: string,
    userId: string
  ): Promise<AssistedRegistrationMemberSnapshot | null>;
}
