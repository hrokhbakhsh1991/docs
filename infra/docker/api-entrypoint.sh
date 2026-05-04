#!/bin/sh
set -eu
cd /app
node dist/src/scripts/run-migrations.js
exec node dist/src/main.js
