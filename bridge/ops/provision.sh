#!/bin/bash
# Create one Dossierly sandbox on the M2 and lock it to the Restricted policy.
# Usage: provision.sh <sandbox-name>
# Env: POLICY_FILE (default ~/.settla/app/agent/policy/dossierly-restricted.yaml)
set -uo pipefail
NAME="${1:?sandbox name required}"
export PATH=/opt/homebrew/bin:$HOME/.local/bin:$PATH
eval "$(fnm env)"
export DOCKER_HOST=unix:///Users/worker/.colima/default/docker.sock
export NEMOCLAW_GATEWAY_PORT=19260
export NEMOCLAW_DISABLE_TELEMETRY=1
POLICY_FILE="${POLICY_FILE:-$HOME/.settla/app/agent/policy/dossierly-restricted.yaml}"
# shellcheck disable=SC1090
source ~/.nc-env

if nemo-deepagents list --json 2>/dev/null | grep -q "\"name\": *\"$NAME\""; then
  echo "exists: $NAME"
else
  NEMOCLAW_NON_INTERACTIVE=1 NEMOCLAW_ACCEPT_THIRD_PARTY_SOFTWARE=1 \
  NEMOCLAW_AGENT=langchain-deepagents-code NEMOCLAW_PROVIDER=custom \
  NEMOCLAW_ENDPOINT_URL=https://api.tokenfactory.nebius.com/v1 \
  NEMOCLAW_MODEL=nvidia/Nemotron-3.5-Super-VL \
  NEMOCLAW_SANDBOX_NAME="$NAME" NEMOCLAW_POLICY_TIER=balanced NEMOCLAW_WEB_SEARCH_PROVIDER=none \
  nemo-deepagents onboard --non-interactive >"/tmp/settla-onboard-$NAME.log" 2>&1 \
    || { echo "onboard failed: $NAME (see /tmp/settla-onboard-$NAME.log)"; exit 1; }
fi

# Narrow egress: drop the default presets, then apply Dossierly Restricted.
for p in brew-balanced brew github huggingface npm pypi; do
  nemo-deepagents "$NAME" policy remove "$p" --yes >/dev/null 2>&1 || true
done
nemo-deepagents "$NAME" policy add --from-file "$POLICY_FILE" --yes 2>&1 | tail -1
openshell settings set "$NAME" --key ocsf_json_enabled --value true --yes >/dev/null 2>&1 \
  || openshell settings set "$NAME" --key ocsf_json_enabled --value true >/dev/null 2>&1
echo "ready: $NAME presets: $(nemo-deepagents "$NAME" policy list 2>/dev/null | grep '●' | sed 's/ — .*//' | tr -s ' ' | tr '\n' ',')"
