#!/bin/bash
# Installs and (re)starts the com.settla.bridge launch agent on the M2. Touches no other launch agent.
set -euo pipefail
cd "$(dirname "$0")/../.."
HOST="${M2_HOST:-m2worker}"
scp -q bridge/ops/com.settla.bridge.plist "$HOST:Library/LaunchAgents/com.settla.bridge.plist"
ssh "$HOST" 'U=$(id -u); launchctl bootout gui/$U/com.settla.bridge 2>/dev/null || true; launchctl bootstrap gui/$U ~/Library/LaunchAgents/com.settla.bridge.plist && launchctl kickstart -k gui/$U/com.settla.bridge && sleep 3 && launchctl list | grep com.settla.bridge'
