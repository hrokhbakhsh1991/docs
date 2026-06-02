import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "../../common/auth/user-role.enum";
import type { UserEntity } from "./entities/user.entity";
import {
  canExposeNationalId,
  diffSelfPiiFieldKeys,
  mapUserEntityToMeProfileResponse
} from "./me-profile.mapper";
import type { SelfPiiSnapshot } from "./me-profile.types";

function stubUser(partial: Partial<UserEntity> & Pick<UserEntity, "id">): UserEntity {
  return {
    email: null,
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

const selfVisibility = (userId: string) => ({
  viewerUserId: userId,
  subjectUserId: userId,
  viewerRole: UserRole.Member
});

test("mapUserEntityToMeProfileResponse returns null email when unset", () => {
  const user = stubUser({
    id: "u1",
    phone: "+989174070937",
    isPhoneVerified: true
  });
  const r = mapUserEntityToMeProfileResponse(user, selfVisibility("u1"));
  assert.equal(r.email, null);
});

test("mapUserEntityToMeProfileResponse passes through stored email", () => {
  const user = stubUser({
    id: "u3",
    email: "person@example.com",
    isEmailVerified: true
  });
  assert.equal(mapUserEntityToMeProfileResponse(user, selfVisibility("u3")).email, "person@example.com");
});

test("self viewer always receives national_id", () => {
  const user = stubUser({
    id: "u-self",
    email: "a@b.com",
    nationalId: "1234567890"
  });
  const r = mapUserEntityToMeProfileResponse(user, {
    viewerUserId: "u-self",
    subjectUserId: "u-self",
    viewerRole: UserRole.Leader
  });
  assert.equal(r.national_id, "1234567890");
});

test("leader viewing another user does not receive national_id", () => {
  const user = stubUser({
    id: "u-other",
    email: "other@b.com",
    nationalId: "1234567890"
  });
  const r = mapUserEntityToMeProfileResponse(user, {
    viewerUserId: "u-leader",
    subjectUserId: "u-other",
    viewerRole: UserRole.Leader
  });
  assert.equal(r.national_id, null);
});

test("owner viewing another user receives national_id", () => {
  const user = stubUser({
    id: "u-other",
    email: "other@b.com",
    nationalId: "1234567890"
  });
  const r = mapUserEntityToMeProfileResponse(user, {
    viewerUserId: "u-owner",
    subjectUserId: "u-other",
    viewerRole: UserRole.Owner
  });
  assert.equal(r.national_id, "1234567890");
});

test("canExposeNationalId is false for admin viewing without self match when role missing", () => {
  assert.equal(
    canExposeNationalId({ viewerUserId: "a", subjectUserId: "b", viewerRole: UserRole.Member }),
    false
  );
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
