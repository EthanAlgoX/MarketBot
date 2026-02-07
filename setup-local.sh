#!/bin/bash
set -e

echo "🚀 Setting up MarketBot with Local Qwen3-0.6B LLM"

# 1. Check/Install Ollama
if ! command -v ollama &> /dev/null; then
    echo "📦 Installing Ollama..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if ! command -v brew &> /dev/null; then
             echo "❌ Homebrew required but not found. Please install Homebrew or Ollama manually: https://ollama.com"
             exit 1
        fi
        brew install ollama
        brew services start ollama
    else
        curl -fsSL https://ollama.com/install.sh | sh
        # Start serve in background if not systemd managed
        ollama serve &
    fi
else
    echo "✅ Ollama is installed."
fi

# 2. Ensure Ollama Service is Running
# Check if API is responsive
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "🔄 Starting Ollama service..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
            brew services start ollama || (ollama serve &)
    else
            ollama serve &
    fi
    echo "Waiting for Ollama to start..."
    sleep 5
fi

# 3. Pull Qwen3 Model
MODEL_NAME="qwen3:0.6b"
echo "📥 Pulling $MODEL_NAME model..."
ollama pull "$MODEL_NAME"

# 4. Setup Configuration
CONFIG_FILE="marketbot.json"
EXAMPLE_FILE="marketbot.json.example"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "⚙️ Creating default configuration ($CONFIG_FILE)..."
    cp "$EXAMPLE_FILE" "$CONFIG_FILE"
    echo "✅ Default configuration created with Qwen3 local model."
else
    echo "⚠️ Configuration file $CONFIG_FILE already exists."
    # Check if Qwen3 is configured
    if grep -q "qwen3:0.6b" "$CONFIG_FILE"; then
         echo "✅ Qwen3 configuration detected in $CONFIG_FILE."
    else
         echo "⚠️ Qwen3 configuration missing in $CONFIG_FILE. Reference $EXAMPLE_FILE to add it."
    fi
fi

echo ""
echo "🎉 Setup complete! MarketBot is ready with local Qwen3-0.6B."
echo "   Run the following command to start:"
echo "   pnpm start"
