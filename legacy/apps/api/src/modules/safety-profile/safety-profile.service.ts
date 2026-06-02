import { Inject, Injectable } from "@nestjs/common";
import {
  SAFETY_PROFILE_PORT,
  type SafetyProfilePort,
} from "./domain/ports/safety-profile.port";
import type { ReplaceEmergencyContactsDto } from "./dto/safety-profile.dto";

export type {
  EmergencyContactResponse,
  MedicalProfileResponse,
} from "./domain/ports/safety-profile.port";

@Injectable()
export class SafetyProfileService {
  constructor(
    @Inject(SAFETY_PROFILE_PORT)
    private readonly safetyProfile: SafetyProfilePort
  ) {}

  listEmergencyContacts(targetUserId: string) {
    return this.safetyProfile.listEmergencyContacts(targetUserId);
  }

  replaceEmergencyContacts(targetUserId: string, dto: ReplaceEmergencyContactsDto) {
    return this.safetyProfile.replaceEmergencyContacts(targetUserId, dto);
  }

  getMedicalProfile(targetUserId: string) {
    return this.safetyProfile.getMedicalProfile(targetUserId);
  }

  upsertMedicalProfile(targetUserId: string, plaintextPayloadUtf8: string) {
    return this.safetyProfile.upsertMedicalProfile(targetUserId, plaintextPayloadUtf8);
  }
}
