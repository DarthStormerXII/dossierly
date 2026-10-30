#!/usr/bin/env bash
# Starts the Dossierly letter-reader LoRA fine-tune as ONE Nebius AI Cloud Serverless GPU job (1x H100, eu-north1), waits, saves the RESULT
# line, deletes the job. The job writes its own data with Nemotron 3.5 Lightning on Token Factory, trains, and evaluates base vs tuned.
#   NEBIUS_API_KEY   Token Factory key (export it from .env.local; never printed)
#   DRY_RUN=1        validate the job request only
#   N_TRAIN / N_TEST / EPOCHS   optional overrides (smoke test: N_TRAIN=20 N_TEST=8 EPOCHS=1)
# The platform minimum timeout is 1 h, so two guards keep the cost under the cap: the job's own watchdog (38 min of Python time) and this script,
# which cancels the job MAX_MIN minutes after creation. At the assumed list price of 4.50 USD per GPU-hour, 44 min is about 3.30 USD.
set -uo pipefail
cd "$(dirname "$0")"
PROFILE="${NEBIUS_PROFILE:-hackathon-jobs-sa}"
PROJECT="${NEBIUS_GPU_PROJECT:-project-e00fwfe5pr00k4s8jdngz0}"   # eu-north1: where the H100 quota is
NAME="dossierly-letter-finetune-$(date +%H%M%S)"
MAX_MIN="${MAX_MIN:-44}"; RATE="${GPU_USD_PER_HOUR:-4.50}"
OUT="${RESULT_FILE:-./result.json}"
: "${NEBIUS_API_KEY:?export NEBIUS_API_KEY}"
ENVS=(--env "NEBIUS_API_KEY=$NEBIUS_API_KEY")
for v in N_TRAIN N_TEST EPOCHS BASE_MODEL; do [ -n "${!v:-}" ] && ENVS+=(--env "$v=${!v}"); done
DRY=(); [ -n "${DRY_RUN:-}" ] && DRY=(--dry-run)
# The tenant allows 2 running compute instances at once; other fine-tunes may hold both, so retry on a quota error until START_BY (HH:MM, default 23:45).
START_BY="${START_BY:-23:45}"; DEADLINE=$(date -j -f "%H:%M" "$START_BY" +%s 2>/dev/null || date -d "$START_BY" +%s)
if [ -n "${ATTACH_ID:-}" ]; then   # resume watching a job this script already created (ATTACH_CREATED = its creation time, epoch seconds)
  ID="$ATTACH_ID"; CREATED="${ATTACH_CREATED:-$(date +%s)}"; NAME="${ATTACH_NAME:-$NAME}"; RESP=attached
else
while :; do
  CREATED=$(date +%s)
  RESP=$(nebius --profile "$PROFILE" ai job create --parent-id "$PROJECT" --name "$NAME" --image pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime \
    --platform gpu-h100-sxm --preset 1gpu-16vcpu-200gb --disk-size 100Gi --timeout 1h --async ${DRY[@]+"${DRY[@]}"} \
    --inject-file ./run.sh:/opt/dossierly/run.sh --inject-file ./spec.py:/opt/dossierly/spec.py --inject-file ./gen.py:/opt/dossierly/gen.py \
    --inject-file ./train_eval.py:/opt/dossierly/train_eval.py "${ENVS[@]}" \
    --container-command bash --args /opt/dossierly/run.sh --format json 2>/tmp/dossierly-launch.err) && break
  RESP="$RESP$(cat /tmp/dossierly-launch.err 2>/dev/null)"
  if printf '%s' "$RESP" | grep -q "Quota" && [ "$(date +%s)" -lt "$DEADLINE" ]; then echo "$(date +%H:%M:%S) quota full (other jobs hold the slots), retrying in 40 s"; sleep 40; continue; fi
  printf '%s\n' "$RESP" | head -6 | cut -c1-300; echo "job create failed"; exit 1
done
fi
[ -n "${DRY_RUN:-}" ] && { echo "dry run ok"; exit 0; }
[ -z "${ATTACH_ID:-}" ] && ID=$(printf '%s' "$RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin)["resource_id"])')
echo "job $NAME id $ID created $(date +%H:%M:%S)"
STATE=""
while :; do
  STATE=$(nebius --profile "$PROFILE" ai job get --id "$ID" --format 'jsonpath={.status.state}' 2>/dev/null)
  case "$STATE" in *COMPLETED*|*FAILED*|*CANCELLED*|*ERROR*) break ;; esac
  if [ $(( $(date +%s) - CREATED )) -gt $(( MAX_MIN * 60 )) ]; then echo "cap reached, cancelling"; nebius --profile "$PROFILE" ai job cancel --id "$ID" >/dev/null 2>&1; STATE=CANCELLED_BY_CAP; break; fi
  sleep 20
done
END=$(date +%s)
echo "state: $STATE after $(( (END - CREATED) / 60 )) min"
LOG=$(nebius --profile "$PROFILE" ai job logs "$ID" 2>&1)
printf '%s\n' "$LOG" | grep -E '^\[ *[0-9.]+s\] (generated|dedupe|model loaded|BASE |TUNED |epoch|BASE_SAMPLE|TUNED_SAMPLE)' | cut -c1-600 | tail -40
RESULT=$(printf '%s\n' "$LOG" | grep '^RESULT ' | tail -1 | sed 's/^RESULT //')
SECS=$(( END - CREATED ))
USD=$(python3 -c "print(round($SECS/3600*$RATE, 2))")
if [ -n "$RESULT" ]; then
  printf '%s' "$RESULT" | python3 -c 'import json,sys; d=json.load(sys.stdin); d.update({"jobId":sys.argv[1],"jobName":sys.argv[2],"billedSecondsApprox":int(sys.argv[3]),"gpuUsdApprox":float(sys.argv[4]),"assumedUsdPerGpuHour":float(sys.argv[5])}); print(json.dumps(d, ensure_ascii=False, indent=1))' "$ID" "$NAME" "$SECS" "$USD" "$RATE" > "$OUT"
  echo "saved $OUT"
else
  printf '%s\n' "$LOG" | tail -25 | cut -c1-400
fi
echo "approx GPU cost: $USD USD ($SECS s at $RATE USD/h)"
echo "job id $ID: delete with  nebius --profile $PROFILE ai job delete --id $ID  (this script does it when a RESULT was read)"
[ -n "$RESULT" ] && nebius --profile "$PROFILE" ai job delete --id "$ID" >/dev/null 2>&1 && echo "job deleted"
