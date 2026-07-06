import { DenaliDifficultyRangeSlider } from "./components/denali-difficulty-range-slider";
import { DenaliTimeInput } from "./components/denali-time-input";
import {
  DenaliLocationPickerMap,
  DenaliLocationPickerMapInner,
  ensureLeafletDefaultIcon,
} from "./components/map/denali-location-picker-map";
import { DenaliWizardDatetimePicker } from "./components/localized-datetime-picker";

export type DenaliOperatorUiComponentsSurface = {
  readonly TimeInput: typeof DenaliTimeInput;
  readonly DifficultyRangeSlider: typeof DenaliDifficultyRangeSlider;
  readonly LocationPickerMap: typeof DenaliLocationPickerMap;
  readonly LocationPickerMapInner: typeof DenaliLocationPickerMapInner;
  readonly ensureLeafletDefaultIcon: typeof ensureLeafletDefaultIcon;
  readonly WizardDatetimePicker: typeof DenaliWizardDatetimePicker;
};

export const denaliOperatorUiComponentsSurface: DenaliOperatorUiComponentsSurface = Object.freeze({
  TimeInput: DenaliTimeInput,
  DifficultyRangeSlider: DenaliDifficultyRangeSlider,
  LocationPickerMap: DenaliLocationPickerMap,
  LocationPickerMapInner: DenaliLocationPickerMapInner,
  ensureLeafletDefaultIcon,
  WizardDatetimePicker: DenaliWizardDatetimePicker,
});
