/**
 * Perf guard: flat-edit DenaliSection + RHF field registration (Jest/jsdom only).
 */
jest.mock("@/components/tours/DenaliTourEditForm.module.css", () => ({
  section: "section",
  sectionTitle: "sectionTitle",
  sectionBody: "sectionBody",
}));

jest.mock("@/features/tours/denali/fields/DenaliFieldRenderer", () => {
  const React = require("react") as typeof import("react");
  const { useFormContext, Controller } = require("react-hook-form") as typeof import("react-hook-form");

  function DenaliFieldRendererStub({
    field,
  }: {
    field: { canonicalPath: string; rhfPath: string };
  }) {
    const { control } = useFormContext();
    return React.createElement(Controller, {
      control,
      name: field.rhfPath,
      render: ({ field: rhfField }: { field: Record<string, unknown> }) =>
        React.createElement("input", {
          "data-canonical-path": field.canonicalPath,
          "data-field-path": field.rhfPath,
          value: typeof rhfField.value === "string" ? rhfField.value : "",
          onChange: rhfField.onChange,
          onBlur: rhfField.onBlur,
          ref: rhfField.ref,
        }),
    });
  }

  return { DenaliFieldRenderer: DenaliFieldRendererStub };
});

import React from "react";
import { act, render } from "@testing-library/react";
import { listDenaliRegistryCanonicalPaths } from "@repo/denali-domain";

import { DENALI_EDIT_SECTION_IDS } from "@/features/tours/denali/fields/denaliSectionSuppress";
import { DenaliFlatEditMountTarget } from "@test-utils/denali-flat-edit-mount-target";

const MAX_MEAN_MS = Number(process.env.DENALI_SECTION_MOUNT_MAX_MEAN_MS ?? "100");
const TARGET_FIELD_COUNT = 50;
const WARMUP_ITERATIONS = 2;
const BENCH_ITERATIONS = 5;

describe("denali flat-edit section mount (perf guard)", () => {
  it("mounts 50+ registry fields within latency ceiling", () => {
    const registryFieldCount = listDenaliRegistryCanonicalPaths().length;
    expect(registryFieldCount).toBeGreaterThanOrEqual(TARGET_FIELD_COUNT);

    for (let i = 0; i < WARMUP_ITERATIONS; i += 1) {
      const { unmount } = render(<DenaliFlatEditMountTarget />);
      act(() => {});
      unmount();
    }

    const samples: number[] = [];
    for (let i = 0; i < BENCH_ITERATIONS; i += 1) {
      const t0 = performance.now();
      const { unmount } = render(<DenaliFlatEditMountTarget />);
      act(() => {});
      samples.push(performance.now() - t0);
      unmount();
    }

    const meanMs = samples.reduce((sum, v) => sum + v, 0) / samples.length;

    // eslint-disable-next-line no-console -- perf diagnostic
    console.log(
      JSON.stringify({
        task: "denali flat-edit DenaliSection mount (jsdom)",
        registryFieldCount,
        sectionCount: DENALI_EDIT_SECTION_IDS.length,
        iterations: BENCH_ITERATIONS,
        meanMs,
        maxMeanMs: MAX_MEAN_MS,
        samples,
      }),
    );

    expect(meanMs).toBeLessThan(MAX_MEAN_MS);
  });
});
