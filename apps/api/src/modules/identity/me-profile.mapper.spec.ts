import assert from "node:assert/strict";
import test from "node:test";
import type { UserEntity } from "./entities/user.entity";
import { diffSelfPiiFieldKeys, mapUserEntityToMeProfileResponse } from "./me-profile.mapper";
import type { SelfPiiSnapshot } from "./me-profile.types";

function stubUser(partial: Partial<UserEntity> & Pick<UserEntity, "id" | "email">): UserEntity {
  return {
    fullName: null,
    nationalId: null,
    gender: null,
    birthDate: null,
    phone: null,
    isPhoneVerified: false,
    isEmailVerified: false,
    notificationsEnabled: null,
    profileRowVersion: 1,
    ...partial
  } as UserEntity;
}

test("mapUserEntityToMeProfileResponse omits phone onboarding placeholder email", () => {
  const user = stubUser({
    id: "u1",
    email: "phone_989174070937@local.invalid",
    phone: "+989174070937",
    isPhoneVerified: true
  });
  const r = mapUserEntityToMeProfileResponse(user);
  assert.equal(r.email, null);
});

test("mapUserEntityToMeProfileResponse omits telegram onboarding placeholder email", () => {
  const user = stubUser({
    id: "u2",
    email: "telegram_12345@local.invalid"
  });
  assert.equal(mapUserEntityToMeProfileResponse(user).email, null);
});

test("mapUserEntityToMeProfileResponse passes through real stored email", () => {
  const user = stubUser({
    id: "u3",
    email: "person@example.com",
    isEmailVerified: true
  });
  assert.equal(mapUserEntityToMeProfileResponse(user).email, "person@example.com");
});

test("diffSelfPiiFieldKeys reports only changed PII snapshot keys", () => {
  const before: SelfPiiSnapshot = {
    full_name: "A",
    national_id: null,
    gender: null,
    birth_date: null
  };
  const after: SelfPiiSnapshot = { ...before, full_name: "B" };
  assert.deepEqual(diffSelfPiiFieldKeys(before, after), ["full_name"]);
});
