import { getMemberReceiptProofSignedReadUrl } from "../../workspace-finance/receipt-proof-storage";

export type ResolvedIntegrationMedia = {
  readonly kind: "photo" | "document";
  readonly url: string;
};

export function resolveIntegrationMediaKindFromStorageKey(
  storageKey: string
): "photo" | "document" {
  const lower = storageKey.trim().toLowerCase();
  return /\.(png|jpe?g|webp|gif)(?:-[a-f0-9]{16,64})?$/.test(lower) ? "photo" : "document";
}

/** Resolve private receipt media only at delivery time, never in the durable event. */
export async function resolveIntegrationMedia(input: {
  readonly tenantId: string;
  readonly storageKey: string;
}): Promise<ResolvedIntegrationMedia> {
  const storageKey = input.storageKey.trim();
  if (storageKey.length === 0) {
    throw new Error("INTEGRATION_MEDIA_STORAGE_KEY_REQUIRED");
  }

  return {
    kind: resolveIntegrationMediaKindFromStorageKey(storageKey),
    url: await getMemberReceiptProofSignedReadUrl({
      tenantId: input.tenantId,
      storageKey,
      expiresInSeconds: 120,
    }),
  };
}
