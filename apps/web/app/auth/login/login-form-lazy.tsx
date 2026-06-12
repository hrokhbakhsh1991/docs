"use client";

import dynamic from "next/dynamic";

import { LoginFormFallback } from "./login-form-fallback";

export const LoginFormLazy = dynamic(
  () => import("./login-form").then((mod) => mod.LoginForm),
  { ssr: false, loading: () => <LoginFormFallback /> }
);
