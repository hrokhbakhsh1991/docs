export type PlatformSslProvisionInput = {
  readonly hostname: string;
  readonly surface: "marketing" | "portal";
};

export type PlatformSslProvisionResult = {
  readonly ok: boolean;
  readonly expiresAt: Date | null;
  readonly errorMessage?: string;
};

export interface PlatformSslProvider {
  provision(input: PlatformSslProvisionInput): Promise<PlatformSslProvisionResult>;
}
