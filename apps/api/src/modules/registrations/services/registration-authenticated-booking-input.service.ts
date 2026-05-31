import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";

import { tenantContextMissingError } from "../../../common/errors/error-response-builders";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import {
  RegistrationEntryModeDto,
  RegistrationTransportModeDto,
} from "../dto/create-registration.dto";
import { UserEntity } from "../../identity/entities/user.entity";
import { syntheticBookingContactPhone } from "../../../common/security/ownership-scope";
import type {
  AuthenticatedBookingInput,
  IRegistrationLookupPort,
} from "../domain/ports/registration-lookup.port";

@Injectable()
export class RegistrationAuthenticatedBookingInputService implements IRegistrationLookupPort {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService,
  ) {}

  async resolveAuthenticatedBookingInput(tourId: string): Promise<AuthenticatedBookingInput> {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    const userId = this.requestContextService.getUserId();
    if (!tenantId || !userId) {
      throw new ForbiddenException(tenantContextMissingError());
    }

    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() },
    });
    if (!user) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "User not found",
        },
      });
    }

    const participantFullName =
      (user.fullName?.trim() && user.fullName.trim().length > 0
        ? user.fullName.trim()
        : undefined) ??
      user.email?.split("@")[0] ??
      "Participant";

    return {
      tourId,
      participantFullName,
      participantContactPhone: syntheticBookingContactPhone(userId),
      transportMode: RegistrationTransportModeDto.GROUP_VEHICLE,
      entryMode: RegistrationEntryModeDto.WEB,
      telegramUserId: user.telegramUserId ?? undefined,
      telegramUsername: undefined,
    };
  }
}
