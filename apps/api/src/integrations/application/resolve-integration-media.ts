import { getMemberReceiptProofSignedReadUrl } from "../../workspace-finance/receipt-proof-storage";

export type ResolvedIntegrationMedia = {
  readonly kind: "photo" | "document";
  readonly url: string;
};

function mediaKindFromStorageKey(storageKey: string): "photo" | "document" {
  const lower = storageKey.trim().toLowerCase();
  return /\.(png|jpe?g|webp|gif)$/.test(lower) ? "photo" : "document";
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
    kind: mediaKindFromStorageKey(storageKey),
    url: await getMemberReceiptProofSignedReadUrl({
      tenantId: input.tenantId,
      storageKey,
      expiresInSeconds: 120,
    }),
  };
}
