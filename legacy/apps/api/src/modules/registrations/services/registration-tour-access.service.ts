import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EntityManager, IsNull } from "typeorm";

import { tenantScopedResourceNotFoundError } from "../../../common/errors/error-response-builders";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { validateIranNationalIdChecksum } from "../../identity/utils/iran-national-id";
import { UserEntity } from "../../identity/entities/user.entity";
import { TenantBootstrapService } from "../../tenant/tenant-bootstrap.service";
import { RegistrationBookingTargetDto } from "../dto/create-registration.dto";
import {
  REGISTRATIONS_TOUR_CATALOG_PORT,
  type RegistrationsTourCatalogPort,
  type TourCatalogSnapshot,
} from "../domain/ports/registrations-tour-catalog.port";

@Injectable()
export class RegistrationTourAccessService {
  constructor(
    @Inject(TenantBootstrapService) private readonly tenantBootstrapService: TenantBootstrapService,
    @Inject(REGISTRATIONS_TOUR_CATALOG_PORT)
    private readonly registrationsTourCatalogPort: RegistrationsTourCatalogPort,
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService,
  ) {}

  async getTenantIdForTourOrThrow(tourId: string): Promise<string> {
    const tenantId = await this.tenantBootstrapService.resolveTenantFromTourId(tourId);
    if (!tenantId) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    return tenantId;
  }

  async requireTourInTenant(
    manager: EntityManager,
    tourId: string,
    tenantId: string,
  ): Promise<TourCatalogSnapshot> {
    const tour = await this.registrationsTourCatalogPort.getTourSnapshot(manager, tourId);
    if (!tour) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    if (tour.tenantId !== tenantId) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    return tour;
  }

  async requireTourInTenantForUpdate(
    manager: EntityManager,
    tourId: string,
    tenantId: string,
  ): Promise<TourCatalogSnapshot> {
    const tour = await this.registrationsTourCatalogPort.lockTourSnapshot(manager, tourId, tenantId);
    if (!tour) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    return tour;
  }

  async assertTourNationalIdRegistrationPolicyOrThrow(
    manager: EntityManager,
    tourId: string,
    payload: { bookingTarget?: string; participantNationalId?: string },
  ): Promise<void> {
    const tour = await this.registrationsTourCatalogPort.getTourSnapshot(manager, tourId);
    const participation = tour?.details?.tripDetails?.participation as
      | { registrationNationalIdRequired?: boolean }
      | undefined;
    if (participation?.registrationNationalIdRequired !== true) {
      return;
    }

    const bookingTarget = payload.bookingTarget ?? RegistrationBookingTargetDto.SELF;

    if (bookingTarget === RegistrationBookingTargetDto.GUEST) {
      const guestNationalId = payload.participantNationalId?.trim();
      if (!guestNationalId) {
        throw new BadRequestException({
          error: {
            code: "REGISTRATION_GUEST_NATIONAL_ID_REQUIRED",
            message: "Guest national ID is required for this tour.",
          },
        });
      }
      if (!validateIranNationalIdChecksum(guestNationalId)) {
        throw new BadRequestException({
          error: {
            code: "REGISTRATION_GUEST_NATIONAL_ID_INVALID",
            message: "Provided guest national ID is mathematically invalid.",
          },
        });
      }
      return;
    }

    const userId = this.requestContextService.getUserId()?.trim();
    if (!userId) {
      throw new BadRequestException({
        error: {
          code: "REGISTRATION_AUTH_REQUIRED",
          message:
            "This tour requires a national ID on your profile; sign in with your workspace session (browser cookies or Bearer token) before registering.",
        },
      });
    }

    const profileUser = await manager.findOne(UserEntity, {
      where: { id: userId, deletedAt: IsNull() },
      select: { nationalId: true },
    });
    const nationalId = profileUser?.nationalId?.trim();
    if (!nationalId) {
      throw new BadRequestException({
        error: {
          code: "PROFILE_NATIONAL_ID_REQUIRED",
          message: "Add your national ID in profile settings before registering for this tour.",
        },
      });
    }
  }
}
