import { randomInt, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export function generateOtpCode(length = 6): string {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += String(randomInt(0, 10));
  }
  return code;
}

export function resolveOtpCodeForChallenge(): string {
  const fixture = process.env.OTP_FIXTURE_CODE?.trim();
  if (fixture !== undefined && fixture.length > 0 && process.env.NODE_ENV !== "production") {
    return fixture;
  }
  return generateOtpCode(6);
}

export async function hashOtpCode(code: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(code.trim(), salt, 32)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyOtpCodeHash(code: string, storedHash: string): Promise<boolean> {
  const [salt, hashHex] = storedHash.split(":");
  if (salt === undefined || salt.length === 0 || hashHex === undefined || hashHex.length === 0) {
    return false;
  }
  const derived = (await scryptAsync(code.trim(), salt, 32)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}
