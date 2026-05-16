import type { PatchMeDto } from "../dto/patch-me.dto";

/** True when the PATCH body attempts to change persisted profile fields on `users` (requires concurrency token). */
export function patchMeDtoMutatesUserProfile(dto: PatchMeDto): boolean {
  return (
    dto.full_name !== undefined ||
    dto.email !== undefined ||
    dto.notifications_enabled !== undefined ||
    dto.national_id !== undefined ||
    dto.gender !== undefined ||
    dto.birth_date !== undefined
  );
}
