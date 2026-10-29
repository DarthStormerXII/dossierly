#!/bin/bash
# Runs the NeMo Guardrails 0.24.1 audit as a Nebius Serverless Job (CPU, eu-west2 profile), then posts the
# result to the Dossierly ingest route and deletes the job. Tokens are passed by command substitution and never printed.
#   NEBIUS_API_KEY  Token Factory key (export it, e.g. from .env.local)
#   BRIDGE_SECRET   used only locally to derive the job-scoped token (HMAC), never sent to Nebius
#   INGEST_URL      default https://dossierly.pages.dev/api/bridge/job-result
set -uo pipefail
cd "$(dirname "$0")"
PROFILE="${NEBIUS_PROFILE:-hackathon-jobs-sa}"
NAME="settla-guardrails-audit-$(date +%H%M%S)"
INGEST_URL="${INGEST_URL:-https://dossierly.pages.dev/api/bridge/job-result}"
: "${NEBIUS_API_KEY:?export NEBIUS_API_KEY}"; : "${BRIDGE_SECRET:?export BRIDGE_SECRET}"
JOB_TOKEN=$(printf 'settla-job-result' | openssl dgst -sha256 -hmac "$BRIDGE_SECRET" -hex | awk '{print $NF}')

ID=$(nebius --profile "$PROFILE" ai job create --name "$NAME" --image python:3.12 --platform cpu-d3 --preset 4vcpu-16gb \
  --container-command bash --args '-c "pip install -q nemoguardrails==0.24.1 langchain-openai && python /app/audit.py"' \
  --inject-file ./audit.py:/app/audit.py --timeout 1h --async \
  --env "OPENAI_API_KEY=$NEBIUS_API_KEY" --env "NEBIUS_API_KEY=$NEBIUS_API_KEY" \
  --env "INGEST_URL=$INGEST_URL" --env "JOB_TOKEN=$JOB_TOKEN" --env "JOB_NAME=settla-guardrails-audit" \
  --env "JOB_REGION=eu-west2" --env "JOB_PLATFORM=cpu-d3 4vcpu-16gb" --format 'jsonpath={.resource_id}') || { echo "job create failed"; exit 1; }
echo "job $NAME id $ID"

for _ in $(seq 1 120); do
  STATE=$(nebius --profile "$PROFILE" ai job get "$ID" --format 'jsonpath={.status.state}' 2>/dev/null)
  case "$STATE" in *COMPLETED*|*FAILED*|*CANCELLED*|*ERROR*) break ;; esac
  sleep 10
done
echo "state: $STATE"
LOG=$(nebius --profile "$PROFILE" ai job logs "$ID" 2>&1)
RESULT=$(printf '%s\n' "$LOG" | grep '^AUDIT_RESULT ' | tail -1 | sed 's/^AUDIT_RESULT //')
printf '%s\n' "$LOG" | grep -E '^(POSTED|POST_FAILED|AUDIT_FAILED)' | tail -2
if [ -n "$RESULT" ] && ! printf '%s' "$LOG" | grep -q '^POSTED 200'; then
  printf '%s' "$RESULT" | curl -s -m 30 -o /dev/null -w "relay post: %{http_code}\n" -X POST "${RELAY_URL:-$INGEST_URL}" -H "content-type: application/json" -H "x-job-token: $JOB_TOKEN" --data-binary @-
fi
printf '%s\n' "$RESULT" > "${RESULT_FILE:-/dev/null}"
nebius --profile "$PROFILE" ai job delete "$ID" >/dev/null 2>&1 && echo "job deleted"
