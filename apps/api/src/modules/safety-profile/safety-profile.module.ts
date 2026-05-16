import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IdentityModule } from "../identity/identity.module";
import { EmergencyContactEntity } from "./entities/emergency-contact.entity";
import { MedicalProfileEntity } from "./entities/medical-profile.entity";
import { LocalDevMedicalProfileEncryptionAdapter } from "./encryption/local-dev-medical-profile-encryption.adapter";
import {
  MEDICAL_PROFILE_ENCRYPTION,
  type MedicalProfileEncryptionPort
} from "./encryption/medical-profile-encryption.port";
import { ThrowingMedicalProfileEncryptionAdapter } from "./encryption/throwing-medical-profile-encryption.adapter";
import { SafetyProfileController } from "./safety-profile.controller";
import { SafetyProfileService } from "./safety-profile.service";

function createMedicalEncryptionAdapter(): MedicalProfileEncryptionPort {
  const secret = process.env.SAFETY_PROFILE_LOCAL_DATA_KEY?.trim();
  if (secret && secret.length >= 16) {
    return new LocalDevMedicalProfileEncryptionAdapter(secret);
  }
  return new ThrowingMedicalProfileEncryptionAdapter();
}

@Module({
  imports: [TypeOrmModule.forFeature([EmergencyContactEntity, MedicalProfileEntity]), IdentityModule],
  controllers: [SafetyProfileController],
  providers: [
    SafetyProfileService,
    {
      provide: MEDICAL_PROFILE_ENCRYPTION,
      useFactory: () => createMedicalEncryptionAdapter()
    }
  ],
  exports: [SafetyProfileService, TypeOrmModule]
})
export class SafetyProfileModule {}
