"use client";

import { useEffect, useRef } from "react";

import {
  isClientBlobUrl,
  revokeBlobUrlsFromPhotoRows,
  revokeDenaliBlobUrl,
} from "../preserveDenaliWizardBlobMedia";

type BlobPhotoRow = {
  url?: string | null;
};

/**
 * Revokes detached `blob:` URLs when rows are removed, replaced, or the host unmounts (EC-MEM-07).
 */
export function useDenaliBlobPhotoRowLifecycle(rows: readonly BlobPhotoRow[] | undefined): void {
  const prevRowsRef = useRef<readonly BlobPhotoRow[]>(rows ?? []);

  useEffect(() => {
    const prev = prevRowsRef.current;
    const next = rows ?? [];
    const nextBlobUrls = new Set(
      next.map((row) => row.url).filter((url): url is string => isClientBlobUrl(url)),
    );

    for (const row of prev) {
      if (isClientBlobUrl(row.url) && !nextBlobUrls.has(row.url)) {
        revokeDenaliBlobUrl(row.url);
      }
    }

    prevRowsRef.current = next;
  }, [rows]);

  useEffect(() => {
    return () => {
      revokeBlobUrlsFromPhotoRows(prevRowsRef.current);
    };
  }, []);
}
