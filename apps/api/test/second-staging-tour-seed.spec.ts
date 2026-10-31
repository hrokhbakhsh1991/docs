import assert from "node:assert/strict";
import test from "node:test";
import { seedRunScopedTourIfMissing } from "../scripts/lib/denali-second-staging-tour-seed";

const tour = { id: "tour-1", tenantId: "tenant-1", canonical: { title: "Expected" } };

test("run-scoped tour seed no-ops only for an exact pre-existing canonical row", async () => {
  let creates = 0;
  await seedRunScopedTourIfMissing(tour, {
    getById: async () => tour,
    createOnly: async () => {
      creates += 1;
    },
  });
  assert.equal(creates, 0);
});

test("run-scoped tour seed rejects a pre-existing canonical collision", async () => {
  let creates = 0;
  await assert.rejects(
    seedRunScopedTourIfMissing(tour, {
      getById: async () => ({ ...tour, canonical: { title: "Different" } }),
      createOnly: async () => {
        creates += 1;
      },
    }),
    /DENALI_SECOND_STAGING_FIXTURE_TOUR_COLLISION/
  );
  assert.equal(creates, 0);
});

test("run-scoped tour seed uses create-only after a missing precheck and preserves a raced duplicate", async () => {
  const existingRows = new Map<string, typeof tour>();
  const repository = {
    getById: async () => null,
    createOnly: async (candidate: typeof tour) => {
      if (existingRows.has(candidate.id)) throw new Error("UNIQUE_CONSTRAINT");
      existingRows.set(candidate.id, candidate);
    },
  };
  existingRows.set(tour.id, { ...tour, canonical: { title: "Concurrent owner" } });

  await assert.rejects(seedRunScopedTourIfMissing(tour, repository), /UNIQUE_CONSTRAINT/);
  assert.deepEqual(existingRows.get(tour.id)?.canonical, { title: "Concurrent owner" });
});
