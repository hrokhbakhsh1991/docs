import {
  decodeTourActionSubmitError,
  encodeTourActionSubmitError,
  isTourActionSubmitError,
  type TourActionSubmitErrorPayload,
} from "./tour-action-submit-error-codec";

export type TourActionSubmitCodecSurface = {
  readonly encode: typeof encodeTourActionSubmitError;
  readonly decode: typeof decodeTourActionSubmitError;
  readonly isTourActionSubmitError: typeof isTourActionSubmitError;
};

export type { TourActionSubmitErrorPayload };

export const denaliTourActionSubmitCodec: TourActionSubmitCodecSurface = Object.freeze({
  encode: encodeTourActionSubmitError,
  decode: decodeTourActionSubmitError,
  isTourActionSubmitError,
});
