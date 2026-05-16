import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { MedicalCipherMaterial, MedicalProfileEncryptionPort } from "./medical-profile-encryption.port";

@Injectable()
export class ThrowingMedicalProfileEncryptionAdapter implements MedicalProfileEncryptionPort {
  async encrypt(_plaintextUtf8: string): Promise<MedicalCipherMaterial> {
    throw new ServiceUnavailableException({
      error: {
        code: "MEDICAL_ENCRYPTION_NOT_CONFIGURED",
        message:
          "Medical profile encryption is not configured. Set SAFETY_PROFILE_LOCAL_DATA_KEY (dev only) or wire a KMS-backed MedicalProfileEncryptionPort."
      }
    });
  }

  async decrypt(): Promise<string> {
    throw new ServiceUnavailableException({
      error: {
        code: "MEDICAL_ENCRYPTION_NOT_CONFIGURED",
        message:
          "Medical profile encryption is not configured. Set SAFETY_PROFILE_LOCAL_DATA_KEY (dev only) or wire a KMS-backed MedicalProfileEncryptionPort."
      }
    });
  }
}
