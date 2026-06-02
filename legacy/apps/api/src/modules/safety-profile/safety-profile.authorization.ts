import { ForbiddenException } from "@nestjs/common";
import { subject } from "@casl/ability";
import type { AppAbility } from "@repo/shared";
import { AbilityAction } from "../../common/casl/ability-actions";

export function assertCanReadMedicalProfile(ability: AppAbility, targetUserId: string): void {
  if (!ability.can(AbilityAction.Read, subject("MedicalProfile", { ownerUserId: targetUserId }))) {
    throw new ForbiddenException({
      error: { code: "SAFETY_PROFILE_FORBIDDEN", message: "Cannot read medical profile for this user" }
    });
  }
}

export function assertCanUpdateMedicalProfile(ability: AppAbility, targetUserId: string): void {
  if (!ability.can(AbilityAction.Update, subject("MedicalProfile", { ownerUserId: targetUserId }))) {
    throw new ForbiddenException({
      error: { code: "SAFETY_PROFILE_FORBIDDEN", message: "Cannot update medical profile for this user" }
    });
  }
}

export function assertCanReadEmergencyContacts(ability: AppAbility, targetUserId: string): void {
  if (!ability.can(AbilityAction.Read, subject("EmergencyContact", { ownerUserId: targetUserId }))) {
    throw new ForbiddenException({
      error: { code: "SAFETY_PROFILE_FORBIDDEN", message: "Cannot read emergency contacts for this user" }
    });
  }
}

export function assertCanUpdateEmergencyContacts(ability: AppAbility, targetUserId: string): void {
  if (!ability.can(AbilityAction.Update, subject("EmergencyContact", { ownerUserId: targetUserId }))) {
    throw new ForbiddenException({
      error: { code: "SAFETY_PROFILE_FORBIDDEN", message: "Cannot update emergency contacts for this user" }
    });
  }
}
