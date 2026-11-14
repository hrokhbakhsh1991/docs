import { createHmac, timingSafeEqual } from "node:crypto";
import { BlockList, isIP } from "node:net";

type PasswordClientIpConfig =
  | { readonly mode: "direct" }
  | { readonly mode: "trusted-edge"; readonly trusted: BlockList };

/** Production must explicitly choose its ingress model; no broad proxy trust. */
export function readPasswordClientIpConfig(
  env: NodeJS.ProcessEnv = process.env
): PasswordClientIpConfig | null {
  const mode =
    env.PASSWORD_AUTH_CLIENT_IP_MODE?.trim() || (env.NODE_ENV === "production" ? "" : "direct");
  if (mode === "direct") return { mode };
  if (mode !== "trusted-edge") return null;
  const ranges = env.PASSWORD_AUTH_TRUSTED_EDGE_CIDRS?.split(",").map((x) => x.trim()) ?? [];
  if (ranges.length === 0 || ranges.length > 64) return null;
  const trusted = new BlockList();
  for (const range of ranges) {
    const parts = range.split("/");
    const address = parts[0] ?? "";
    const family = isIP(address);
    const rawPrefix = parts[1] ?? "";
    if (parts.length !== 2 || !/^\d{1,3}$/.test(rawPrefix) || family === 0) return null;
    const prefix = Number(rawPrefix);
    if (prefix < 1 || prefix > (family === 4 ? 32 : 128)) return null;
    try {
      trusted.addSubnet(address, prefix, family === 4 ? "ipv4" : "ipv6");
    } catch {
      return null;
    }
  }
  return { mode: "trusted-edge", trusted };
}

/** `peer` is overwritten by the ingress proxy; `forwarded` is used only for a trusted edge. */
export function resolvePasswordClientIp(
  peer: string,
  forwarded: string,
  config: PasswordClientIpConfig
): string | null {
  const candidate = peer.trim();
  const family = isIP(candidate);
  if (!family) return null;
  if (config.mode === "direct") return candidate;
  if (!config.trusted.check(candidate, family === 4 ? "ipv4" : "ipv6")) return null;
  const client = forwarded.trim();
  return isIP(client) ? client : null;
}

type PasswordIngress = {
  readonly tenantId: string;
  readonly mobile: string;
  readonly ip: string;
  readonly timestamp: number;
};

function validInput(input: PasswordIngress, secret: Buffer): boolean {
  return (
    secret.length === 32 &&
    /^[a-zA-Z0-9_-]{1,128}$/.test(input.tenantId) &&
    /^\+?[0-9]{8,16}$/.test(input.mobile) &&
    isIP(input.ip) !== 0 &&
    Number.isSafeInteger(input.timestamp) &&
    input.timestamp > 0
  );
}

export function signPasswordIngress(input: PasswordIngress, secret: Buffer): string {
  if (!validInput(input, secret)) throw new Error("PASSWORD_INGRESS_INVALID");
  const message = `password-ingress-v1\n${input.timestamp}\n${input.tenantId}\n${input.mobile}\n${input.ip}`;
  return createHmac("sha256", secret).update(message).digest("hex");
}

export function verifyPasswordIngress(
  input: PasswordIngress,
  signature: string,
  secret: Buffer,
  now = Date.now()
): boolean {
  if (!validInput(input, secret) || !/^[0-9a-f]{64}$/.test(signature)) return false;
  if (input.timestamp > now + 5_000 || now - input.timestamp > 30_000) return false;
  const expected = Buffer.from(signPasswordIngress(input, secret), "hex");
  const actual = Buffer.from(signature, "hex");
  return timingSafeEqual(expected, actual);
}

export function readPasswordIngressSecret(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const value = env.PASSWORD_AUTH_INGRESS_SECRET?.trim();
  return value !== undefined && /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, "hex") : null;
}
