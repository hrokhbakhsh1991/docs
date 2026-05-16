export type MedicalCipherMaterial = {
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
  /** Optional KMS envelope (design); null when using local/dev key only. */
  wrappedContentKey: Buffer | null;
  kmsKeyId: string | null;
};

export const MEDICAL_PROFILE_ENCRYPTION = Symbol("MEDICAL_PROFILE_ENCRYPTION");

/**
 * Port for encrypting medical payloads at rest. Production wiring should use a KMS-backed adapter.
 * Implementations must **never** log decrypted plaintext.
 */
export interface MedicalProfileEncryptionPort {
  encrypt(plaintextUtf8: string): Promise<MedicalCipherMaterial>;
  decrypt(material: MedicalCipherMaterial): Promise<string>;
}
