#!/bin/bash
# Re-applies the Dossierly Restricted policy (and the optional off-repo preview preset) to every sandbox.
# Runs on the M2. Usage: apply-policy.sh [sandbox ...]   (default: sample + pool)
set -uo pipefail
export PATH=/opt/homebrew/bin:$HOME/.local/bin:$PATH
export DOCKER_HOST=unix:///Users/worker/.colima/default/docker.sock NEMOCLAW_GATEWAY_PORT=19260 NEMOCLAW_DISABLE_TELEMETRY=1
POLICY="$HOME/.settla/app/agent/policy/dossierly-restricted.yaml"
PREVIEW="$HOME/.settla/policy/dossierly-preview.yaml"   # local only, never committed
SANDBOXES=("$@"); [ ${#SANDBOXES[@]} -eq 0 ] && SANDBOXES=(companion-arjun settla-pool-01 settla-pool-02 settla-pool-03 settla-pool-04)
for S in "${SANDBOXES[@]}"; do
  nemo-deepagents "$S" start >/dev/null 2>&1 || true
  for p in settla-restricted brew-balanced brew github huggingface npm pypi; do
    nemo-deepagents "$S" policy remove "$p" --yes >/dev/null 2>&1 || true
  done
  nemo-deepagents "$S" policy add --from-file "$POLICY" --yes 2>&1 | tail -1
  [ -f "$PREVIEW" ] && nemo-deepagents "$S" policy add --from-file "$PREVIEW" --yes 2>&1 | tail -1
  openshell settings set "$S" --key ocsf_json_enabled --value true >/dev/null 2>&1
  echo "$S: $(nemo-deepagents "$S" policy list 2>/dev/null | grep '●' | sed 's/ — .*//;s/^ *//' | tr '\n' ',')"
done
