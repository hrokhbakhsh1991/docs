import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { afterEach, before, describe, it } from "node:test";
import { cleanup, render } from "@testing-library/react";

import { OperatorProfileAvatar } from "../src/admin/patterns/operator-profile-avatar";
import { BookingMemberAvatar } from "../src/features/bookings/booking-member-avatar";
import { bookingsRowAvatarTestId } from "../src/features/bookings/bookings-command-center-types";

const AVATAR_A =
  "data:image/svg+xml," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect fill="red" width="32" height="32"/></svg>');
const AVATAR_B =
  "data:image/svg+xml," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect fill="blue" width="32" height="32"/></svg>');

const WEB_ROOT = join(import.meta.dirname, "..");

function readWebSource(path: string): string {
  return readFileSync(join(WEB_ROOT, path), "utf8");
}

before(() => {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
});

afterEach(() => {
  cleanup();
});

describe("operator-profile-avatar.spec.ts — image error contract", () => {
  it("WEB-BKG-AVT-07 resets image error when avatarUrl or userId changes", () => {
    const source = readWebSource("src/admin/patterns/operator-profile-avatar.tsx");
    assert.match(source, /const \[imageError, setImageError\] = useState\(false\)/);
    assert.match(source, /setImageError\(false\)/);
    assert.match(source, /\[initialAvatarUrl, userId\]/);
    assert.match(source, /onError=\{\(\) => \{\s*setImageError\(true\)/);
    assert.match(source, /key=\{`\$\{userId\}:\$\{avatarUrl\}`\}/);
  });

  it("WEB-BKG-AVT-08 broken avatar handling is per component instance", () => {
    const source = readWebSource("src/admin/patterns/operator-profile-avatar.tsx");
    assert.match(source, /showImage = avatarUrl !== null && avatarUrl.length > 0 && !imageError/);
    assert.doesNotMatch(source, /let lastAvatarUrl|globalAvatarCache/);
  });
});

describe("booking-member-avatar.spec.ts — row identity", () => {
  it("WEB-BKG-AVT-09 scopes test id per booking and keys avatar by memberUserId", () => {
    const source = readWebSource("src/features/bookings/booking-member-avatar.tsx");
    assert.match(source, /bookingsRowAvatarTestId\(item\.id\)/);
    assert.match(source, /key=\{`\$\{memberUserId\}:\$\{avatarUrl/);
    assert.match(source, /memberUserId \?\? item\.id/);
    assert.doesNotMatch(source, /displayName=\{item\.guestLabel\}/);

    const view = render(
      <BookingMemberAvatar
        item={{
          id: "00000000-0000-4000-8000-000000000401",
          guestLabel: "Guest A",
          memberUserId: "00000000-0000-4000-8000-000000000201",
          memberAvatarUrl: "https://example.com/a.png",
        }}
      />
    );
    assert.ok(
      view.getByTestId(
        bookingsRowAvatarTestId("00000000-0000-4000-8000-000000000401")
      )
    );
  });

  it("WEB-BKG-AVT-10 renders icon fallback when memberAvatarUrl is null", () => {
    const view = render(
      <BookingMemberAvatar
        item={{
          id: "00000000-0000-4000-8000-000000000403",
          guestLabel: "Guest C",
          memberUserId: "00000000-0000-4000-8000-000000000203",
          memberAvatarUrl: null,
        }}
      />
    );
    assert.equal(view.container.querySelector("[data-operator-profile-avatar-image]"), null);
    assert.ok(view.container.querySelector("[data-operator-profile-avatar-icon]"));
  });

  it("WEB-BKG-AVT-11 reordering rows keeps memberUserId key on avatar subtree", () => {
    const source = readWebSource("src/features/bookings/booking-member-avatar.tsx");
    assert.match(source, /key=\{`\$\{memberUserId\}:\$\{avatarUrl/);
    const inboxRow = readWebSource("src/features/bookings/booking-inbox-row.tsx");
    assert.match(inboxRow, /data-booking-row/);
    const shell = readWebSource("src/features/bookings/bookings-command-center-shell.tsx");
    assert.match(shell, /Fragment key=\{item\.id\}/);
  });

  it("WEB-BKG-AVT-12 avatarUrl prop change remounts image subtree", () => {
    const view = render(
      <OperatorProfileAvatar userId="member-a" avatarUrl={AVATAR_A} fallbackMode="icon" />
    );
    view.rerender(<OperatorProfileAvatar userId="member-a" avatarUrl={AVATAR_B} fallbackMode="icon" />);
    const source = readWebSource("src/admin/patterns/operator-profile-avatar.tsx");
    assert.match(source, /setAvatarUrl\(initialAvatarUrl\)/);
    assert.match(source, /key=\{`\$\{userId\}:\$\{avatarUrl\}`\}/);
  });
});
