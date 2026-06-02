"use client";

import { createContext } from "react";

import type { UseToastReturn } from "./types";

export const ToastContext = createContext<UseToastReturn | null>(null);
