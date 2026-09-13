#!/usr/bin/env bash
# Removes the Nexra monitoring agent from this server: stops and disables
# the systemd service, then deletes the unit and binary it installed.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/MHBehzadian/nexra-panel/main/agent/uninstall.sh \
#     | sudo bash
#
# This only removes the agent from this server. It doesn't touch the
# server's entry in the panel's server list - remove that separately from
# Manage Servers (the pencil icon next to Refresh) if you want it gone
# from the dashboard too.

set -euo pipefail

BIN_PATH="/usr/local/bin/nexra-agent"
SERVICE_PATH="/etc/systemd/system/nexra-agent.service"

if [[ "$EUID" -ne 0 ]]; then
  echo "Run this script as root." >&2
  exit 1
fi

if [[ -f "$SERVICE_PATH" ]]; then
  systemctl disable --now nexra-agent 2>/dev/null || true
fi

rm -f "$SERVICE_PATH" "$BIN_PATH"
rm -rf /opt/nexra-agent

systemctl daemon-reload

echo "Nexra agent removed from this server."
