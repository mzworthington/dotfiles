#!/bin/bash

set -e

echo "=================================================="
echo "🚀 Starting Local AI Development Environment Setup"
echo "=================================================="

if ! pgrep -x "ollama" > /dev/null && ! curl -s http://localhost:11434 > /dev/null; then
    echo "Error: Ollama is installed but does not appear to be running."
    echo "Please start Ollama before running this script."
    exit 1
fi

echo "Pulling Qwen 3.5 27B model for heavy chat and reasoning (this may take a few minutes)..."
ollama pull qwen3.5:27b

echo "Pulling Qwen 2.5 Coder 1.5B model for lightning-fast tab-completion..."
ollama pull qwen2.5-coder:1.5b

if [[ "$OSTYPE" == "darwin"* ]]; then
    CONTINUE_DIR="$HOME/.continue"
else
    CONTINUE_DIR="$HOME/.continue"
fi

CONFIG_FILE="$CONTINUE_DIR/config.json"

echo "Configuring Continue extension at: $CONFIG_FILE"
mkdir -p "$CONTINUE_DIR"

cat << 'EOF' > "$CONFIG_FILE"
{
  "models": [
    {
      "title": "Qwen 3.5 27B (Local Chat)",
      "provider": "ollama",
      "model": "qwen3.5:27b"
    }
  ],
  "tabAutocompleteModel": {
    "title": "Qwen 2.5 Coder 1.5B (Local Tab)",
    "provider": "ollama",
    "model": "qwen2.5-coder:1.5b"
  },
  "ui": {
    "codeBlockTheme": "github-dark"
  }
}
EOF

echo "=================================================="
echo "🎉 Setup Complete!"
echo "=================================================="
echo "Next Steps:"
echo "1. If you haven't already, install the 'Continue' extension in VS Code."
echo "2. Open VS Code, open the Continue sidebar, and select your local model."
echo "3. Test your autocomplete by typing code in any file!"
echo "=================================================="