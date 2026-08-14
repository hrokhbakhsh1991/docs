import { getIdentityRepository } from "../../identity/create-identity-repository";
import type {
  AssistedRegistrationMemberSnapshot,
  BookingAssistedRegistrationMembersPort,
} from "../ports/booking-assisted-registration-members.port";

export class HostBookingAssistedRegistrationMembersAdapter
  implements BookingAssistedRegistrationMembersPort
{
  async findTenantMember(
    tenantId: string,
    userId: string
  ): Promise<AssistedRegistrationMemberSnapshot | null> {
    const membership = await getIdentityRepository().findMembership(userId, tenantId);
    if (membership === null) {
      return null;
    }
    return {
      userId: membership.userId,
      status: membership.status,
    };
  }
}
