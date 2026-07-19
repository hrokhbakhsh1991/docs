/**
 * Phase B1.4 — BookingPublicPort neutrality (no Denali naming in Booking application).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { BookingPublicPort } from "./ports/booking-public.port.ts";
import { createHostBookingPublicAdapter } from "./infrastructure/host-booking-public.adapter.ts";

const here = dirname(fileURLToPath(import.meta.url));

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walkTsFiles(full));
      continue;
    }
    if (!name.endsWith(".ts")) continue;
    if (name.endsWith(".generated.ts")) continue;
    if (name.endsWith(".spec.ts")) continue;
    out.push(full);
  }
  return out;
}

describe("BK-B1.4 BookingPublicPort neutrality", () => {
  it("Booking application sources have no DenaliPublicBookingPort or workspace-denali imports", () => {
    for (const file of walkTsFiles(here)) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /DenaliPublicBookingPort/);
      assert.doesNotMatch(src, /DenaliPublicBookingCreate/);
      assert.doesNotMatch(src, /@app-tour\/workspace-denali/);
    }
  });

  it("host adapter implements BookingPublicPort surface", () => {
    const port: BookingPublicPort = createHostBookingPublicAdapter();
    assert.equal(typeof port.findDuplicateByTourGuest, "function");
    assert.equal(typeof port.findDuplicateByTourGuestLabel, "function");
    assert.equal(typeof port.findDuplicateByTourGuestNationalId, "function");
    assert.equal(typeof port.findDuplicateByTourEmail, "function");
    assert.equal(typeof port.createPendingBooking, "function");
    assert.equal(typeof port.sumApprovedPartySizeByTourIds, "function");
  });

  it("contracts package exports BookingPublicPort (SoT)", () => {
    const contractsPort = readFileSync(
      join(here, "../../../../packages/booking-http-contracts/src/booking-public.port.ts"),
      "utf8"
    );
    assert.match(contractsPort, /export interface BookingPublicPort/);
    assert.doesNotMatch(contractsPort, /DenaliPublicBookingPort/);
  });

  it("Denali product host resolves via createHostBookingPublicAdapter", () => {
    const host = readFileSync(
      join(here, "../http/configure-workspace-denali-product-http-host.ts"),
      "utf8"
    );
    assert.match(host, /createHostBookingPublicAdapter/);
    assert.match(host, /BookingPublicPort/);
    assert.doesNotMatch(host, /DenaliPublicBookingPort/);
  });
});
