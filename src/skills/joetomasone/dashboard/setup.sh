#!/bin/bash
# Clawd Dashboard Setup Script
# Installs and starts the Kanban task management dashboard

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_DIR="${DASHBOARD_DIR:-$HOME/clawd-dashboard}"
PORT="${DASHBOARD_PORT:-5050}"

echo "🤖 Clawd Dashboard Setup"
echo "========================"
echo "Install directory: $DASHBOARD_DIR"
echo "Port: $PORT"
echo ""

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please install Python 3."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
if command -v apt-get &> /dev/null; then
    sudo apt-get install -y python3-flask python3-flask-cors 2>/dev/null || \
    pip3 install flask flask-cors --break-system-packages 2>/dev/null || \
    pip3 install flask flask-cors
elif command -v pip3 &> /dev/null; then
    pip3 install flask flask-cors
else
    echo "❌ Cannot install dependencies. Please install flask and flask-cors manually."
    exit 1
fi

# Create directory structure
echo "📁 Creating dashboard directory..."
mkdir -p "$DASHBOARD_DIR"/{templates,static/css,static/js,data}

# Copy files
echo "📋 Copying files..."
cp "$SCRIPT_DIR/src/app.py" "$DASHBOARD_DIR/"
cp "$SCRIPT_DIR/src/templates/index.html" "$DASHBOARD_DIR/templates/"
cp "$SCRIPT_DIR/src/static/css/style.css" "$DASHBOARD_DIR/static/css/"
cp "$SCRIPT_DIR/src/static/js/dashboard.js" "$DASHBOARD_DIR/static/js/"

# Update port if non-default
if [ "$PORT" != "5050" ]; then
    sed -i "s/port=5050/port=$PORT/" "$DASHBOARD_DIR/app.py"
fi

# Kill any existing dashboard
pkill -f "python3.*app.py.*$PORT" 2>/dev/null || true

# Start the dashboard
echo "🚀 Starting dashboard..."
cd "$DASHBOARD_DIR"
nohup python3 app.py > /tmp/clawd-dashboard.log 2>&1 &
sleep 2

# Check if running
if curl -s "http://localhost:$PORT/api/status" > /dev/null 2>&1; then
    echo ""
    echo "✅ Dashboard is running!"
    echo ""
    echo "Access URLs:"
    echo "  Local:     http://localhost:$PORT"
    
    # Show network IPs
    if command -v hostname &> /dev/null; then
        LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
        [ -n "$LOCAL_IP" ] && echo "  Network:   http://$LOCAL_IP:$PORT"
    fi
    
    if command -v tailscale &> /dev/null; then
        TS_IP=$(tailscale ip -4 2>/dev/null)
        [ -n "$TS_IP" ] && echo "  Tailscale: http://$TS_IP:$PORT"
    fi
    
    echo ""
    echo "Logs: /tmp/clawd-dashboard.log"
else
    echo "❌ Dashboard failed to start. Check /tmp/clawd-dashboard.log"
    exit 1
fi
