import { TENANT_MAX_HOST_LENGTH } from "./constants";

export function stripHostPort(hostWithOptionalPort: string): string {
  const trimmed = hostWithOptionalPort.trim();
  if (trimmed.startsWith("[") && trimmed.includes("]")) {
    const end = trimmed.indexOf("]");
    return trimmed.slice(0, end + 1);
  }
  const colonIndex = trimmed.lastIndexOf(":");
  if (colonIndex > 0 && trimmed.slice(colonIndex + 1).match(/^\d+$/)) {
    return trimmed.slice(0, colonIndex);
  }
  return trimmed;
}

function isValidHostnameStructure(host: string): boolean {
  if (host.startsWith("[") && host.endsWith("]")) {
    const inner = host.slice(1, -1);
    return inner.length >= 1 && /^[0-9a-f:]+$/i.test(inner);
  }

  const labels = host.split(".");
  if (labels.length < 1 || labels.length > 127) {
    return false;
  }

  for (const label of labels) {
    if (label.length === 0 || label.length > 63) {
      return false;
    }
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) {
      return false;
    }
  }

  return true;
}

export function normalizeInboundHostname(
  raw: string,
): { ok: true; host: string } | { ok: false } {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return { ok: false };
  }

  const withoutPort = stripHostPort(trimmed);
  if (!withoutPort) {
    return { ok: false };
  }

  if (withoutPort.length > TENANT_MAX_HOST_LENGTH) {
    return { ok: false };
  }

  if (withoutPort.includes("..")) {
    return { ok: false };
  }

  if (!isValidHostnameStructure(withoutPort)) {
    return { ok: false };
  }

  return { ok: true, host: withoutPort };
}
