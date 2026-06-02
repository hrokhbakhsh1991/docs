import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MedicalCipherMaterial, MedicalProfileEncryptionPort } from "./medical-profile-encryption.port";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const KDF_SALT = Buffer.from("safety-profile-local-v1", "utf8");

/**
 * **Development / single-node only** — derives a static key from `secret`.
 * Replace with KMS envelope encryption for production.
 */
@Injectable()
export class LocalDevMedicalProfileEncryptionAdapter implements MedicalProfileEncryptionPort {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = scryptSync(secret, KDF_SALT, 32);
  }

  async encrypt(plaintextUtf8: string): Promise<MedicalCipherMaterial> {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, this.key, iv, { authTagLength: 16 });
    const ciphertext = Buffer.concat([cipher.update(plaintextUtf8, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      ciphertext,
      nonce: iv,
      authTag,
      wrappedContentKey: null,
      kmsKeyId: null
    };
  }

  async decrypt(material: MedicalCipherMaterial): Promise<string> {
    const decipher = createDecipheriv(ALGO, this.key, material.nonce, { authTagLength: 16 });
    decipher.setAuthTag(material.authTag);
    return decipher.update(material.ciphertext) + decipher.final("utf8");
  }
}
