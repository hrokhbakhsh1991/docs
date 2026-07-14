#!/usr/bin/env bash
# Next.js production build with clean retry — mitigates transient ENOENT on .next manifests.
set -euo pipefail

attempts="${NEXT_BUILD_RETRY_ATTEMPTS:-3}"
pause_seconds="${NEXT_BUILD_RETRY_PAUSE_SECONDS:-2}"

for ((attempt = 1; attempt <= attempts; attempt++)); do
  if next build; then
    exit 0
  fi

  if ((attempt >= attempts)); then
    echo "next build failed after ${attempts} attempt(s)" >&2
    exit 1
  fi

  echo "next build attempt ${attempt} failed; cleaning .next and retrying..." >&2
  rm -rf .next
  sleep "$pause_seconds"
done
