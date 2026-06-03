/** Five mandatory Phase 0 behavioral invariants (H-03) — direct contract modules (UT-02). */
export const FOUNDATION_INVARIANTS = [
  { id: "canonical-ingress", title: "Canonical Ingress" },
  { id: "storage-immutability", title: "Storage Immutability" },
  { id: "theme-ingress", title: "Theme Ingress" },
  { id: "auth-sealing", title: "Auth Sealing" },
  { id: "plugin-binding", title: "Plugin Binding" },
] as const;

export type FoundationInvariantId = (typeof FOUNDATION_INVARIANTS)[number]["id"];
