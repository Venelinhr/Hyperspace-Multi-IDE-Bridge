#!/usr/bin/env bash
#
# Hyperspace Bridge uninstaller. Idempotent.

set -e

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${YELLOW}ℹ${NC} $1"; }

LABEL="com.hyperspace.bridge"
UID_NUM="$(id -u)"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/com.hyperspace.bridge.plist"
INSTALL_DIR="$HOME/.hyperspace-bridge"

info "Stopping Hyperspace Bridge..."
launchctl bootout "gui/${UID_NUM}/${LABEL}" 2>/dev/null || true

info "Removing files..."
rm -f "$LAUNCH_AGENT"
rm -rf "$INSTALL_DIR"

ok "Hyperspace Bridge removed."
echo "  (Logs at ~/Library/Logs/hyperspace-bridge.log are kept; delete manually if you want.)"
