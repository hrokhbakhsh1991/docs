import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function parseKey(raw: string | undefined): Buffer {
  if (raw === undefined || raw.length === 0) {
    throw new Error("SMS_DELIVERY_ENCRYPTION_KEY_MISSING");
  }
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64url");
  if (key.length !== 32) throw new Error("SMS_DELIVERY_ENCRYPTION_KEY_INVALID");
  return key;
}

export function isOtpDeliveryEncryptionKeyConfigured(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  try {
    parseKey(env.SMS_DELIVERY_ENCRYPTION_KEY?.trim());
    return true;
  } catch {
    return false;
  }
}

function readKey(): Buffer {
  return parseKey(process.env.SMS_DELIVERY_ENCRYPTION_KEY?.trim());
}

export function encryptOtpDeliveryCode(code: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", readKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptOtpDeliveryCode(value: string): string {
  const [version, ivRaw, tagRaw, ciphertextRaw] = value.split(".");
  if (version !== VERSION || !ivRaw || !tagRaw || !ciphertextRaw) throw new Error("SMS_DELIVERY_CIPHERTEXT_INVALID");
  const decipher = createDecipheriv("aes-256-gcm", readKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, "base64url")), decipher.final()]).toString("utf8");
}
