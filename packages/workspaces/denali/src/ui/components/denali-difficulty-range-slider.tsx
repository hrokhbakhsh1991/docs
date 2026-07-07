"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

export type DenaliDifficultyRangeSliderProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

/** Native range input for Denali wizard composites. */
export const DenaliDifficultyRangeSlider = forwardRef<
  HTMLInputElement,
  DenaliDifficultyRangeSliderProps
>(function DenaliDifficultyRangeSlider(props, ref) {
  return <input ref={ref} type="range" {...props} />;
});
