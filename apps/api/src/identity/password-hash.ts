import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { PasswordKdfGate } from "./password-kdf-gate";

// OWASP scrypt profile: 16 MiB memory, r=8, p=5. Persist the profile so future
// upgrades can identify credentials that require rehashing after login.
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELISM = 5;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const MAX_MEMORY = 32 * 1024 * 1024;
const HASH_PREFIX = `scrypt$v1$${COST}$${BLOCK_SIZE}$${PARALLELISM}`;
const passwordKdfGate = new PasswordKdfGate(2, 16);

function derivePassword(password: string, salt: Buffer): Promise<Buffer> {
  return passwordKdfGate.run(
    () =>
      new Promise((resolve, reject) => {
        scrypt(
          password.normalize("NFC"),
          salt,
          KEY_BYTES,
          { N: COST, r: BLOCK_SIZE, p: PARALLELISM, maxmem: MAX_MEMORY },
          (error, derived) => {
            if (error !== null) reject(error);
            else resolve(derived);
          }
        );
      })
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await derivePassword(password, salt);
  return `${HASH_PREFIX}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function isSupportedPasswordHash(stored: string): boolean {
  const parts = stored.split("$");
  return (
    parts.length === 7 &&
    parts.slice(0, 5).join("$") === HASH_PREFIX &&
    /^[0-9a-f]{32}$/.test(parts[5] ?? "") &&
    /^[0-9a-f]{64}$/.test(parts[6] ?? "")
  );
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!isSupportedPasswordHash(stored) || Array.from(password.normalize("NFC")).length > 128) {
    return false;
  }
  const parts = stored.split("$");
  const saltHex = parts[5] ?? "";
  const keyHex = parts[6] ?? "";
  const expected = Buffer.from(keyHex, "hex");
  const derived = await derivePassword(password, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(expected, derived);
}
