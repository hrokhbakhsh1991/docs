/** Phase 4.3 dev host → tenant UUID map (marketing + portal union). */
export const PHASE_43_HOST_TENANT_IDS: Readonly<Record<string, string>> = {
  "tenant-a": "00000000-0000-4000-8000-000000000001",
  "tenant-b": "00000000-0000-4000-8000-000000000002",
  denali: "00000000-0000-4000-8000-000000000003",
  urban: "00000000-0000-4000-8000-000000000004",
  alborz: "00000000-0000-4000-8000-000000000003",
  "workspace-owner-smoke": "00000000-0000-4000-8000-000000000004",
  "workspace-member-smoke": "00000000-0000-4000-8000-000000000004",
  operator: "00000000-0000-4000-8000-000000000014",
  "wallet-ws1": "00000000-0000-4000-8000-000000000420",
  "denali-wallet-pilot": "00000000-0000-4000-8000-000000000430",
  "denali-ticketing-pilot": "00000000-0000-4000-8000-000000000436",
  "guest-club": "eb29a07b-40bb-4e06-9e35-522cb22dab02",
  harbor: "fbdcae8a-2cd8-4c2c-898c-f408bd51321a",
};

export function resolveTenantIdFromIngressLabel(label: string): string | null {
  const normalized = label.trim().toLowerCase();
  return PHASE_43_HOST_TENANT_IDS[normalized] ?? null;
}
