import assert from "node:assert/strict";
import test from "node:test";

import { DenaliTemplateOrchestratorFactory } from "../rules/factory/DenaliTemplateOrchestratorFactory";
import { listDenaliSettingsOverlayStoragePaths } from "../rules/listDenaliSettingsOverlayStoragePaths";
import {
  buildDenaliClonePresetFromTripDetails,
  readDenaliClonePresetFormPath,
} from "./clone-storage-preset-walker";

test("DenaliTemplateOrchestratorFactory exposes Layer C storage paths", () => {
  const factory = new DenaliTemplateOrchestratorFactory();
  assert.deepEqual(factory.listModernOverlayStoragePaths(), listDenaliSettingsOverlayStoragePaths());
  assert.equal(
    DenaliTemplateOrchestratorFactory.modernOverlayStoragePaths.length,
    listDenaliSettingsOverlayStoragePaths().length,
  );
});

test("clone preset walker targets new storage paths without code changes", () => {
  const probeStoragePath = "tripDetails.overview.__cloneProbeField";
  const dynamicPaths = [
    ...new DenaliTemplateOrchestratorFactory().listModernOverlayStoragePaths(),
    probeStoragePath,
  ];

  const tripDetails = {
    overview: {
      __cloneProbeField: ["probe-theme-id"],
      tourThemeIds: ["b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"],
      leaderUserIds: ["a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
    },
    photos: [
      {
        id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c33",
        filename: "tour.jpg",
        size: 1,
        mimeType: "image/jpeg",
        uploadedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
  };

  const probeValue = readDenaliClonePresetFormPath(tripDetails, {
    storagePaths: dynamicPaths,
    formPath: "tripDetails.overview.__cloneProbeField",
  });
  assert.deepEqual(probeValue, ["probe-theme-id"]);

  const themeIds = readDenaliClonePresetFormPath(tripDetails, {
    storagePaths: dynamicPaths,
    formPath: "programNature.themeIds",
  });
  assert.deepEqual(themeIds, ["b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"]);

  const preset = buildDenaliClonePresetFromTripDetails(tripDetails, {
    storagePaths: dynamicPaths,
  });
  assert.ok(preset.photosData?.photos?.length);
});
