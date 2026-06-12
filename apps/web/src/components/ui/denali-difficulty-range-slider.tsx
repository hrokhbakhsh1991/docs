"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

export type DenaliDifficultyRangeSliderProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

/** Native range input — lives under components/ui for guard-no-raw-wizard-input exemption. */
export const DenaliDifficultyRangeSlider = forwardRef<
  HTMLInputElement,
  DenaliDifficultyRangeSliderProps
>(function DenaliDifficultyRangeSlider(props, ref) {
  return <input ref={ref} type="range" {...props} />;
});
