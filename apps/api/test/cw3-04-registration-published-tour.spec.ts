/**
 * CW3-04 — registration published-tour gate dispatch migration parity.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import {
  isRegistrationTourPublishedViaGeneratedBinding,
  isRegistrationTourPublishedViaDispatch,
} from "../src/registrations/registration-published-tour-visibility-compat";

function denaliCanonical(publishStatus: string): CanonicalDocument {
  return {
    schemaVersion: 1,
    roots: ["tour"],
    data: {
      tour: { title: "Sample" },
      publishStatus,
    },
  };
}

function urbanCanonical(publishStatus: string): CanonicalDocument {
  return {
    schemaVersion: 1,
    roots: ["tour"],
    data: {
      tour: { title: "Urban walk", publishStatus },
    },
  };
}

function harborCanonical(status: string): CanonicalDocument {
  return {
    schemaVersion: 1,
    roots: ["status", "title"],
    data: { status, title: "Harbor walk" },
  };
}

describe("CW3-04 registration published-tour visibility dispatch migration", () => {
  it("CW3-04-01 dispatch parity matches workspace binding for denali active/draft", () => {
    const active = denaliCanonical("active");
    const draft = denaliCanonical("draft");
    assert.equal(
      isRegistrationTourPublishedViaDispatch("denali", active),
      isRegistrationTourPublishedViaGeneratedBinding("denali", active),
    );
    assert.equal(
      isRegistrationTourPublishedViaDispatch("denali", draft),
      isRegistrationTourPublishedViaGeneratedBinding("denali", draft),
    );
    assert.equal(isRegistrationTourPublishedViaDispatch("denali", active), true);
    assert.equal(isRegistrationTourPublishedViaDispatch("denali", draft), false);
  });

  it("CW3-04-02 dispatch parity matches workspace binding for urban published/archived", () => {
    const published = urbanCanonical("published");
    const archived = urbanCanonical("archived");
    assert.equal(
      isRegistrationTourPublishedViaDispatch("urban", published),
      isRegistrationTourPublishedViaGeneratedBinding("urban", published),
    );
    assert.equal(
      isRegistrationTourPublishedViaDispatch("urban", archived),
      isRegistrationTourPublishedViaGeneratedBinding("urban", archived),
    );
    assert.equal(isRegistrationTourPublishedViaDispatch("urban", published), true);
    assert.equal(isRegistrationTourPublishedViaDispatch("urban", archived), false);
  });

  it("CW3-04-03 harbor dispatch parity matches workspace binding", () => {
    const published = harborCanonical("published");
    const draft = harborCanonical("draft");
    assert.equal(
      isRegistrationTourPublishedViaDispatch("harbor", published),
      isRegistrationTourPublishedViaGeneratedBinding("harbor", published),
    );
    assert.equal(
      isRegistrationTourPublishedViaDispatch("harbor", draft),
      isRegistrationTourPublishedViaGeneratedBinding("harbor", draft),
    );
    assert.equal(isRegistrationTourPublishedViaDispatch("harbor", published), true);
    assert.equal(isRegistrationTourPublishedViaDispatch("harbor", draft), false);
  });

  it("CW3-04-04 starter fail-closed — dispatch and binding both false", () => {
    const active = denaliCanonical("active");
    assert.equal(isRegistrationTourPublishedViaDispatch("starter", active), false);
    assert.equal(isRegistrationTourPublishedViaGeneratedBinding("starter", active), false);
  });

  it("CW3-04-05 negative — unpublished tours reject registration path (denali draft, urban archived)", () => {
    assert.equal(isRegistrationTourPublishedViaDispatch("denali", denaliCanonical("draft")), false);
    assert.equal(
      isRegistrationTourPublishedViaDispatch("urban", urbanCanonical("archived")),
      false,
    );
    assert.equal(
      isRegistrationTourPublishedViaGeneratedBinding("denali", denaliCanonical("draft")),
      false,
    );
    assert.equal(
      isRegistrationTourPublishedViaGeneratedBinding("urban", urbanCanonical("archived")),
      false,
    );
  });
});
