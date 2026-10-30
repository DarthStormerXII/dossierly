#!/usr/bin/env bash
# Deploy the app Worker (settla-app) in Dodo LIVE mode. Run only after the production URL is settled.
# Usage: worker/deploy-live.sh <scratchpad-with-cf-env> <live-webhook-secret-file>
# Reads CLOUDFLARE_* from <dir>/cf/.env.local and the live API key from the vault (never printed).
set -euo pipefail
DIR="$1"; WH="$2"
set -a; . "$DIR/cf/.env.local"; set +a
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
~/.claude/vault/inject.sh get DODO_PAYMENTS_LIVE_API_KEY --dir "$TMP" >/dev/null
grep '^DODO_PAYMENTS_LIVE_API_KEY=' "$TMP/.env.local" | cut -d= -f2- | tr -d '\n' | npx wrangler secret put DODO_PAYMENTS_API_KEY
npx wrangler secret put DODO_WEBHOOK_KEY < "$WH"
npx opennextjs-cloudflare build
npx wrangler deploy \
  --var DODO_ENV:live \
  --var DODO_PRODUCT_CASE_PASS:pdt_0Nqr5MdtcQ1vyQXIRVKZi \
  --var DODO_PRODUCT_CREDITS_10:pdt_0NqoA4ozmK8SBWGyrzjlR \
  --var DODO_PRODUCT_CREDITS_25:pdt_0NqoA51Fn18zGeSXbmpzn \
  --var DODO_PRODUCT_FAMILY:pdt_0Nqr5MjRO1c3BU4tlKY88 \
  --var APP_ENV:production \
  --var APP_URL:https://dossierly.pages.dev
