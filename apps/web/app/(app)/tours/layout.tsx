import type { ReactNode } from "react";

/** Route-group layout for `/tours/**`; inherits `lang` / `dir` from the root `<html>`. */
export default function ToursLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      {children}
    </div>
  );
}
