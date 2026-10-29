#!/bin/bash
# Copies the bridge and its shared contract files to the M2 (~/.settla/app) and installs zod.
# Usage: bridge/ops/deploy.sh   (from the repo root, with `ssh m2worker` working)
set -euo pipefail
cd "$(dirname "$0")/../.."
HOST="${M2_HOST:-m2worker}"
ssh "$HOST" 'mkdir -p ~/.settla/app/src/lib/agent ~/.settla/app/bridge ~/.settla/app/agent'
rsync -a --delete --exclude node_modules --exclude test bridge/ "$HOST:.settla/app/bridge/"
rsync -a agent/policy agent/prompts "$HOST:.settla/app/agent/"
rsync -a src/lib/agent/schemas.ts src/lib/agent/prompt.ts src/lib/agent/case-memory.ts "$HOST:.settla/app/src/lib/agent/"
scp -q bridge/package.json "$HOST:.settla/app/package.json"
ssh "$HOST" 'export PATH=/opt/homebrew/bin:$HOME/.local/bin:$PATH; eval "$(fnm env)"; cd ~/.settla/app && npm install --omit=dev --no-audit --no-fund --loglevel=error && echo deployed'
