#!/bin/bash
# Install Native Messaging host for YangShuHu Chrome extension
# Usage: ./install.sh [chrome-extension-id]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.openclaw.bridge"
HOST_SCRIPT="$SCRIPT_DIR/openclaw_bridge.py"

# macOS Chrome native messaging hosts directory
NM_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"

# Extension ID — passed as argument or auto-detected
EXT_ID="${1:-}"

if [ -z "$EXT_ID" ]; then
  echo "Usage: ./install.sh <chrome-extension-id>"
  echo ""
  echo "To find your extension ID:"
  echo "  1. Open chrome://extensions"
  echo "  2. Enable Developer mode"
  echo "  3. Copy the ID of 养薯户 extension"
  echo ""
  read -p "Enter extension ID: " EXT_ID
fi

if [ -z "$EXT_ID" ]; then
  echo "Error: Extension ID is required"
  exit 1
fi

# Make host script executable
chmod +x "$HOST_SCRIPT"

# Create NM directory if needed
mkdir -p "$NM_DIR"

# Generate manifest with actual paths
cat > "$NM_DIR/$HOST_NAME.json" << EOF
{
  "name": "$HOST_NAME",
  "description": "OpenClaw Gateway token bridge for YangShuHu",
  "path": "$HOST_SCRIPT",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXT_ID/"]
}
EOF

echo "Native Messaging host installed successfully!"
echo "  Host: $HOST_NAME"
echo "  Script: $HOST_SCRIPT"
echo "  Manifest: $NM_DIR/$HOST_NAME.json"
echo "  Extension: chrome-extension://$EXT_ID/"
echo ""
echo "Restart Chrome for changes to take effect."
