import { Inject, Injectable } from "@nestjs/common";

import type { UserBookingTripRowDto } from "./dto/user-booking-trip-row.dto";
import type { UserBookingSummaryResponseDto } from "./dto/user-booking-summary-response.dto";
import {
  WORKSPACE_IDENTITY_REPOSITORY_PORT,
  type UserBookingSummarySnapshot,
  type WorkspaceIdentityRepositoryPort
} from "./domain/ports/workspace-identity-repository.port";

export type UserBookingSummaryCounts = Pick<
  UserBookingSummaryResponseDto,
  "totalTrips" | "completedTrips" | "cancelledTrips"
>;
export type { UserBookingSummarySnapshot };

/** @deprecated Use {@link WorkspaceIdentityRepositoryPort} booking summary methods directly. */
@Injectable()
export class WorkspaceUserBookingSummaryService {
  constructor(
    @Inject(WORKSPACE_IDENTITY_REPOSITORY_PORT)
    private readonly identityRepository: WorkspaceIdentityRepositoryPort
  ) {}

  loadBookingSummariesForUserIds(
    tenantId: string,
    userIds: readonly string[]
  ): Promise<Map<string, UserBookingSummarySnapshot>> {
    return this.identityRepository.loadBookingSummariesForUserIds(tenantId, userIds);
  }

  loadBookingTripsForUser(tenantId: string, userId: string): Promise<UserBookingTripRowDto[]> {
    return this.identityRepository.loadBookingTripsForUser(tenantId, userId);
  }
}
