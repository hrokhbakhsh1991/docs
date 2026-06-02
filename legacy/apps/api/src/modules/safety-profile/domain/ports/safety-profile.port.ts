import type { ReplaceEmergencyContactsDto } from "../../dto/safety-profile.dto";

export type EmergencyContactResponse = {
  id: string;
  displayName: string;
  phoneE164: string;
  relationship: string;
  isPrimary: boolean;
  sortOrder: number;
};

export type MedicalProfileResponse = {
  userId: string;
  encryptionSchemaVersion: number;
  plaintextPayloadUtf8: string;
};

export const SAFETY_PROFILE_PORT = Symbol("SAFETY_PROFILE_PORT");

export interface SafetyProfilePort {
  listEmergencyContacts(targetUserId: string): Promise<EmergencyContactResponse[]>;
  replaceEmergencyContacts(
    targetUserId: string,
    dto: ReplaceEmergencyContactsDto
  ): Promise<EmergencyContactResponse[]>;
  getMedicalProfile(targetUserId: string): Promise<MedicalProfileResponse | null>;
  upsertMedicalProfile(
    targetUserId: string,
    plaintextPayloadUtf8: string
  ): Promise<MedicalProfileResponse>;
}
