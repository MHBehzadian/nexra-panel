#!/usr/bin/env bash
# Installs the Nexra monitoring agent as a systemd service.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/MHBehzadian/nexra-panel/main/agent/install.sh \
#     | sudo bash -s -- --url "https://panel.example.com/dashboard" --token "<agent-token>"
#
# Must run as root: the agent needs privilege to reboot the machine, and the
# systemd unit installs to /etc/systemd/system.

set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/MHBehzadian/nexra-panel/main/agent"
INSTALL_DIR="/opt/nexra-agent"
BIN_PATH="/usr/local/bin/nexra-agent"
SERVICE_PATH="/etc/systemd/system/nexra-agent.service"
GO_VERSION="1.22.5"

PANEL_URL=""
AGENT_TOKEN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) PANEL_URL="$2"; shift 2 ;;
    --token) AGENT_TOKEN="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$PANEL_URL" || -z "$AGENT_TOKEN" ]]; then
  echo "Usage: install.sh --url <panel-url> --token <agent-token>" >&2
  exit 1
fi

if [[ "$EUID" -ne 0 ]]; then
  echo "Run this script as root (needed for the reboot capability and the systemd unit)." >&2
  exit 1
fi

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) GOARCH="amd64" ;;
  aarch64|arm64) GOARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

mkdir -p "$INSTALL_DIR"
curl -fsSL "$REPO_RAW/main.go" -o "$INSTALL_DIR/main.go"
curl -fsSL "$REPO_RAW/go.mod" -o "$INSTALL_DIR/go.mod"

GO_BIN="$(command -v go || true)"
CLEANUP_GO=0
if [[ -z "$GO_BIN" ]]; then
  echo "Go toolchain not found, downloading a temporary one to build the agent..."
  TMP_GO="/tmp/nexra-go-toolchain"
  rm -rf "$TMP_GO"
  mkdir -p "$TMP_GO"
  curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${GOARCH}.tar.gz" -o /tmp/nexra-go.tar.gz
  tar -C "$TMP_GO" -xzf /tmp/nexra-go.tar.gz
  rm -f /tmp/nexra-go.tar.gz
  GO_BIN="$TMP_GO/go/bin/go"
  CLEANUP_GO=1
fi

echo "Building agent..."
(cd "$INSTALL_DIR" && CGO_ENABLED=0 "$GO_BIN" build -ldflags="-s -w" -o "$BIN_PATH" main.go)

if [[ "$CLEANUP_GO" -eq 1 ]]; then
  rm -rf "$TMP_GO"
fi
rm -rf "$INSTALL_DIR"

cat > "$SERVICE_PATH" <<EOF
[Unit]
Description=Nexra Panel monitoring agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=$BIN_PATH
Environment=PANEL_URL=$PANEL_URL
Environment=AGENT_TOKEN=$AGENT_TOKEN
Restart=always
RestartSec=5
# Root is required so the agent can execute a reboot on request.
User=root
MemoryMax=32M
Nice=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now nexra-agent

echo "Nexra agent installed and running (systemctl status nexra-agent)."
