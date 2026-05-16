import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseTenantEntity } from "../../../database/entities/base-tenant.entity";
import { UserEntity } from "../../identity/entities/user.entity";

/**
 * Medical / sensitive payload stored **only** as ciphertext + AEAD metadata.
 * Plaintext exists transiently in the service layer during encrypt/decrypt — **never log it**.
 *
 * `wrapped_content_key` + `kms_key_id` are reserved for envelope encryption (KMS-wrapped DEK)
 * when a cloud KMS is wired; today they may remain null while `SAFETY_PROFILE_LOCAL_DATA_KEY` dev path is used.
 */
@Entity("medical_profiles")
@Index("idx_medical_profiles_tenant_user", ["tenantId", "userId"])
export class MedicalProfileEntity extends BaseTenantEntity {
  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: UserEntity;

  @Column({ type: "smallint", name: "encryption_schema_version", default: 1 })
  encryptionSchemaVersion!: number;

  @Column({ type: "bytea", name: "ciphertext" })
  ciphertext!: Buffer;

  @Column({ type: "bytea", name: "nonce" })
  nonce!: Buffer;

  @Column({ type: "bytea", name: "auth_tag" })
  authTag!: Buffer;

  @Column({ type: "bytea", name: "wrapped_content_key", nullable: true })
  wrappedContentKey?: Buffer | null;

  @Column({ type: "varchar", length: 128, name: "kms_key_id", nullable: true })
  kmsKeyId?: string | null;
}
