import { WORKSPACE_WIZARD_MEDIA_BINDINGS } from "../tours/workspace-wizard-media-bindings.generated";

type WorkspaceWizardMediaBinding = (typeof WORKSPACE_WIZARD_MEDIA_BINDINGS)[number];

function resolveHostWizardMediaBinding(): WorkspaceWizardMediaBinding {
  const binding = WORKSPACE_WIZARD_MEDIA_BINDINGS[0];
  if (binding === undefined) {
    throw new Error("WORKSPACE_WIZARD_MEDIA_BINDING_MISSING");
  }
  return binding;
}

const hostWizardMediaBinding = resolveHostWizardMediaBinding();

/** Host Minio config — first manifest wizardMedia binding (denali today). */
export function readTenantBrandLogoMinioConfigFromEnv(): ReturnType<
  WorkspaceWizardMediaBinding["readPhotoConfigFromEnv"]
> {
  return hostWizardMediaBinding.readPhotoConfigFromEnv();
}

export async function ensureTenantBrandLogoBucket(
  config: NonNullable<ReturnType<typeof readTenantBrandLogoMinioConfigFromEnv>>
): Promise<void> {
  await hostWizardMediaBinding.ensurePhotoBucket(config);
}

export function createTenantBrandLogoMinioClient(
  config: NonNullable<ReturnType<typeof readTenantBrandLogoMinioConfigFromEnv>>
): ReturnType<WorkspaceWizardMediaBinding["createPhotoClient"]> {
  return hostWizardMediaBinding.createPhotoClient(config);
}

export async function getTenantBrandLogoSignedReadUrl(input: {
  readonly tenantId: string;
  readonly storageKey: string;
  readonly expiresInSeconds?: number;
}): Promise<string> {
  const config = readTenantBrandLogoMinioConfigFromEnv();
  if (config === null) {
    throw new Error("MINIO_NOT_CONFIGURED");
  }
  return hostWizardMediaBinding.getSignedReadUrl({
    config,
    tenantId: input.tenantId,
    key: input.storageKey,
    expiresInSeconds: input.expiresInSeconds ?? 300,
  });
}
