export const FIELD_EXPOSURE_RUNTIME_MODE_ENV = "FIELD_EXPOSURE_RUNTIME_MODE" as const;

export type FieldExposureRuntimeMode = "shadow" | "cutover";

/** Which intent actually drove field/template selection for an emitted job. */
export type FieldExposureSelectionSource =
  | "native_exposure_intent"
  | "exposure_profile_defaults";

export type FieldExposureRuntimeMetadata = {
  readonly mode: FieldExposureRuntimeMode;
  readonly source: "exposure_resolver";
  readonly selectionSource: FieldExposureSelectionSource;
  /** True when no native intent row was active and profile defaults drove the engine decision. */
  readonly nativeIntentMissing: boolean;
  /** True when no engine-selected field ids existed and dispatch emitted an empty active set. */
  readonly engineSelectorMissing?: true;
};

export type FieldExposureRuntimeMetadataOptions = {
  readonly selectionSource?: FieldExposureSelectionSource;
  readonly nativeIntentMissing?: boolean;
  readonly engineSelectorMissing?: boolean;
};

export function resolveFieldExposureRuntimeMode(
  value: string | null | undefined = process.env[FIELD_EXPOSURE_RUNTIME_MODE_ENV],
): FieldExposureRuntimeMode {
  return value?.trim().toLowerCase() === "cutover" ? "cutover" : "shadow";
}

export function fieldExposureRuntimeMetadata(
  mode: FieldExposureRuntimeMode = resolveFieldExposureRuntimeMode(),
  options: FieldExposureRuntimeMetadataOptions = {},
): FieldExposureRuntimeMetadata {
  const metadata: FieldExposureRuntimeMetadata = {
    mode,
    source: "exposure_resolver",
    selectionSource: options.selectionSource ?? "exposure_profile_defaults",
    nativeIntentMissing: options.nativeIntentMissing ?? false,
  };

  return {
    ...metadata,
    ...(options.engineSelectorMissing === true ? { engineSelectorMissing: true as const } : {}),
  };
}
