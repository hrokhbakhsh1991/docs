#!/usr/bin/env bash
# P7 T4 — print session card for architect/operator (terminal)
set -euo pipefail

cat <<'CARD'
╔══════════════════════════════════════════════════════════════╗
║  P7 T4 — Customer sign-off session (~30 min)                 ║
╠══════════════════════════════════════════════════════════════╣
║  Admin      http://89.45.89.206:23000/auth/login             ║
║  Marketing  http://89.45.89.206:23002/tours                ║
║  Portal     http://89.45.89.206:23003                        ║
╠══════════════════════════════════════════════════════════════╣
║  Operator OTP: +15550001001 / 1234                         ║
║  Fresh guest (VS-03..05): +15550002002 / 1234              ║
║  Smoke tour: North Ridge Trek · …0210                        ║
╠══════════════════════════════════════════════════════════════╣
║  VS-01 Admin publish  →  VS-02 Marketing list              ║
║  VS-03 Register OTP   →  VS-04 /me/registrations           ║
║  VS-05 Receipt upload →  VS-06 Approve booking             ║
║  VS-07 Finance receipt → VS-08 p7:gate (architect)          ║
╠══════════════════════════════════════════════════════════════╣
║  Before: pnpm run p7:t4-day                               ║
║  After:  P7_T4_ARCHITECT=… P7_T4_OPERATOR=… pnpm run p7:t4-closeout
║  Docs:   docs/phase-20/p7/runbooks/p7-t4-sign-off-session-fa.md
╚══════════════════════════════════════════════════════════════╝
CARD
