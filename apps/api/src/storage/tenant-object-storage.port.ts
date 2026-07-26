/**
 * SK4.D — tenant-isolated object/blob port (not tour aggregate storage).
 * @see docs/phase-saas-kernel/appendices/SK4_OBJ_IMPLEMENTATION.md
 */

export type TenantObjectRef = {
  readonly tenantId: string;
  readonly storageKey: string;
};

export interface TenantObjectStoragePort {
  put(
    input: TenantObjectRef & {
      readonly body: Buffer;
      readonly contentType: string;
    }
  ): Promise<void>;
  getSignedReadUrl(
    input: TenantObjectRef & {
      readonly ttlSeconds?: number;
    }
  ): Promise<string>;
  remove(input: TenantObjectRef): Promise<void>;
}
