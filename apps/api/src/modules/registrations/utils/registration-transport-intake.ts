import type { ParticipantMetadataDto } from "../dto/participant-metadata.dto";
import {
  RegistrationTransportModeDto,
  type CreateRegistrationDto,
} from "../dto/create-registration.dto";

export type TransportIntakePersistence = {
  isDriver: boolean;
  plateNumber?: string;
  shareFuelCost?: boolean;
};

export function buildTransportIntakeForMetadata(
  dto: Pick<CreateRegistrationDto, "transportMode" | "isDriver" | "plateNumber" | "shareFuelCost">,
): TransportIntakePersistence | undefined {
  if (dto.transportMode !== RegistrationTransportModeDto.SELF_VEHICLE) {
    return undefined;
  }
  if (dto.isDriver === true) {
    const plate = dto.plateNumber?.trim();
    return {
      isDriver: true,
      ...(plate ? { plateNumber: plate } : {}),
    };
  }
  if (dto.isDriver === false) {
    return {
      isDriver: false,
      ...(dto.shareFuelCost !== undefined ? { shareFuelCost: dto.shareFuelCost } : {}),
    };
  }
  return undefined;
}

export function participantMetadataRecordForPersistence(input: {
  participantMetadata?: ParticipantMetadataDto;
  transportMode: RegistrationTransportModeDto;
  isDriver?: boolean;
  plateNumber?: string;
  shareFuelCost?: boolean;
}): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  const peaks = input.participantMetadata?.userPastPeaksCount;
  if (peaks !== undefined) {
    out.userPastPeaksCount = peaks;
  }
  const transportIntake =
    buildTransportIntakeForMetadata(input) ?? input.participantMetadata?.transportIntake;
  if (transportIntake != null && typeof transportIntake === "object") {
    out.transportIntake = transportIntake;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
