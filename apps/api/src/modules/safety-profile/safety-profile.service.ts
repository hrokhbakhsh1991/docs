import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, IsNull, Repository } from "typeorm";
import { TenantContextMissingError } from "../../common/errors/tenant-context-missing.error";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { WorkspaceAbilityFactoryService } from "../../common/casl/workspace-ability.factory.service";
import { UsersAccessService } from "../identity/users-access.service";
import { EmergencyContactEntity } from "./entities/emergency-contact.entity";
import { MedicalProfileEntity } from "./entities/medical-profile.entity";
import type { ReplaceEmergencyContactsDto } from "./dto/safety-profile.dto";
import {
  assertCanReadEmergencyContacts,
  assertCanReadMedicalProfile,
  assertCanUpdateEmergencyContacts,
  assertCanUpdateMedicalProfile
} from "./safety-profile.authorization";
import type { MedicalProfileEncryptionPort } from "./encryption/medical-profile-encryption.port";
import { MEDICAL_PROFILE_ENCRYPTION } from "./encryption/medical-profile-encryption.port";

export type EmergencyContactResponse = {
  id: string;
  displayName: string;
  phoneE164: string;
  relationship: string;
  isPrimary: boolean;
  sortOrder: number;
};

export type MedicalProfileResponse = {
  userId: string;
  encryptionSchemaVersion: number;
  plaintextPayloadUtf8: string;
};

@Injectable()
export class SafetyProfileService {
  private readonly logger = new Logger(SafetyProfileService.name);

  constructor(
    @InjectRepository(EmergencyContactEntity)
    private readonly emergencyRepo: Repository<EmergencyContactEntity>,
    @InjectRepository(MedicalProfileEntity)
    private readonly medicalRepo: Repository<MedicalProfileEntity>,
    private readonly dataSource: DataSource,
    private readonly requestContext: RequestContextService,
    private readonly usersAccess: UsersAccessService,
    private readonly abilityFactory: WorkspaceAbilityFactoryService,
    @Inject(MEDICAL_PROFILE_ENCRYPTION)
    private readonly medicalCrypto: MedicalProfileEncryptionPort
  ) {}

  async listEmergencyContacts(targetUserId: string): Promise<EmergencyContactResponse[]> {
    const tenantId = this.resolveTenantId();
    const ability = this.abilityFactory.createForActiveRequest();
    assertCanReadEmergencyContacts(ability, targetUserId);
    await this.usersAccess.findTenantScopedUserOrThrow(tenantId, targetUserId);
    const rows = await this.emergencyRepo.find({
      where: { tenantId, userId: targetUserId, deletedAt: IsNull() },
      order: { sortOrder: "ASC", createdAt: "ASC" }
    });
    this.logger.log({
      msg: "safety_emergency_contacts_listed",
      tenantId,
      targetUserId,
      count: rows.length
    });
    return rows.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      phoneE164: r.phoneE164,
      relationship: r.relationship,
      isPrimary: r.isPrimary,
      sortOrder: r.sortOrder
    }));
  }

  async replaceEmergencyContacts(
    targetUserId: string,
    dto: ReplaceEmergencyContactsDto
  ): Promise<EmergencyContactResponse[]> {
    const tenantId = this.resolveTenantId();
    const ability = this.abilityFactory.createForActiveRequest();
    assertCanUpdateEmergencyContacts(ability, targetUserId);
    await this.usersAccess.findTenantScopedUserOrThrow(tenantId, targetUserId);

    return this.dataSource.transaction(async (mgr) => {
      await mgr.softDelete(EmergencyContactEntity, { tenantId, userId: targetUserId });
      const created: EmergencyContactEntity[] = [];
      for (const c of dto.contacts) {
        const row = mgr.create(EmergencyContactEntity, {
          tenantId,
          userId: targetUserId,
          displayName: c.displayName,
          phoneE164: c.phoneE164,
          relationship: c.relationship,
          isPrimary: Boolean(c.isPrimary),
          sortOrder: c.sortOrder ?? 0
        });
        created.push(await mgr.save(row));
      }
      this.logger.log({
        msg: "safety_emergency_contacts_replaced",
        tenantId,
        targetUserId,
        count: created.length
      });
      return created.map((r) => ({
        id: r.id,
        displayName: r.displayName,
        phoneE164: r.phoneE164,
        relationship: r.relationship,
        isPrimary: r.isPrimary,
        sortOrder: r.sortOrder
      }));
    });
  }

  async getMedicalProfile(targetUserId: string): Promise<MedicalProfileResponse | null> {
    const tenantId = this.resolveTenantId();
    const ability = this.abilityFactory.createForActiveRequest();
    assertCanReadMedicalProfile(ability, targetUserId);
    await this.usersAccess.findTenantScopedUserOrThrow(tenantId, targetUserId);

    const row = await this.medicalRepo.findOne({
      where: { tenantId, userId: targetUserId, deletedAt: IsNull() }
    });
    if (!row) {
      this.logger.log({ msg: "safety_medical_profile_miss", tenantId, targetUserId });
      return null;
    }

    const plaintextPayloadUtf8 = await this.medicalCrypto.decrypt({
      ciphertext: row.ciphertext,
      nonce: row.nonce,
      authTag: row.authTag,
      wrappedContentKey: row.wrappedContentKey ?? null,
      kmsKeyId: row.kmsKeyId ?? null
    });

    this.logger.log({
      msg: "safety_medical_profile_read",
      tenantId,
      targetUserId,
      encryptionSchemaVersion: row.encryptionSchemaVersion
    });

    return {
      userId: targetUserId,
      encryptionSchemaVersion: row.encryptionSchemaVersion,
      plaintextPayloadUtf8
    };
  }

  async upsertMedicalProfile(targetUserId: string, plaintextPayloadUtf8: string): Promise<MedicalProfileResponse> {
    const tenantId = this.resolveTenantId();
    const ability = this.abilityFactory.createForActiveRequest();
    assertCanUpdateMedicalProfile(ability, targetUserId);
    await this.usersAccess.findTenantScopedUserOrThrow(tenantId, targetUserId);

    const material = await this.medicalCrypto.encrypt(plaintextPayloadUtf8);

    const row = await this.dataSource.transaction(async (mgr) => {
      const existing = await mgr.findOne(MedicalProfileEntity, {
        where: { tenantId, userId: targetUserId, deletedAt: IsNull() }
      });
      if (existing) {
        existing.ciphertext = material.ciphertext;
        existing.nonce = material.nonce;
        existing.authTag = material.authTag;
        existing.wrappedContentKey = material.wrappedContentKey;
        existing.kmsKeyId = material.kmsKeyId;
        existing.encryptionSchemaVersion = 1;
        return mgr.save(existing);
      }
      const created = mgr.create(MedicalProfileEntity, {
        tenantId,
        userId: targetUserId,
        encryptionSchemaVersion: 1,
        ciphertext: material.ciphertext,
        nonce: material.nonce,
        authTag: material.authTag,
        wrappedContentKey: material.wrappedContentKey,
        kmsKeyId: material.kmsKeyId
      });
      return mgr.save(created);
    });

    this.logger.log({
      msg: "safety_medical_profile_upserted",
      tenantId,
      targetUserId,
      encryptionSchemaVersion: row.encryptionSchemaVersion
    });

    return {
      userId: targetUserId,
      encryptionSchemaVersion: row.encryptionSchemaVersion,
      plaintextPayloadUtf8
    };
  }

  private resolveTenantId(): string {
    const tenantId = this.requestContext.resolveEffectiveTenantId()?.trim().toLowerCase();
    if (!tenantId) {
      throw new TenantContextMissingError("tenant context is required for safety profile access");
    }
    return tenantId;
  }
}
