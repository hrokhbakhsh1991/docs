"use client";

import { useSyncExternalStore } from "react";

function subscribeToDocumentDarkClass(onStoreChange: () => void): () => void {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function readDocumentDarkClass(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** Mirrors `html.dark` toggled by operator theme mode (and portal/marketing dark paths). */
export function useDocumentDarkMode(): boolean {
  return useSyncExternalStore(subscribeToDocumentDarkClass, readDocumentDarkClass, () => false);
}
