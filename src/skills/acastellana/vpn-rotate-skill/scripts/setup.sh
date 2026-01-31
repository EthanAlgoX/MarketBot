#!/bin/bash
# VPN Rotate Skill - Setup Wizard
set -e

echo "🔄 VPN Rotate Skill - Setup"
echo "==========================="
echo

# Check OpenVPN
echo "1. Checking OpenVPN..."
if command -v openvpn &> /dev/null; then
    echo "   ✅ OpenVPN installed"
else
    echo "   ❌ OpenVPN not found"
    echo "   Installing..."
    sudo apt update && sudo apt install -y openvpn
    echo "   ✅ OpenVPN installed"
fi
echo

# Check/create directories
echo "2. Setting up directories..."
CONFIG_DIR="$HOME/.vpn/servers"
CREDS_FILE="$HOME/.vpn/creds.txt"

mkdir -p "$CONFIG_DIR"
echo "   ✅ Created $CONFIG_DIR"

# Check for existing configs (ProtonVPN fallback)
PROTON_DIR="$HOME/.config/protonvpn/servers"
if [ -d "$PROTON_DIR" ] && [ "$(ls -A $PROTON_DIR 2>/dev/null)" ]; then
    echo "   Found existing ProtonVPN configs!"
    read -p "   Use ProtonVPN configs? [Y/n]: " use_proton
    if [ "${use_proton:-y}" != "n" ]; then
        CONFIG_DIR="$PROTON_DIR"
        CREDS_FILE="$HOME/.config/protonvpn/creds.txt"
        echo "   ✅ Using ProtonVPN: $CONFIG_DIR"
    fi
fi
echo

# Check for .ovpn files
echo "3. Checking for server configs..."
OVPN_COUNT=$(ls "$CONFIG_DIR"/*.ovpn 2>/dev/null | wc -l || echo 0)
if [ "$OVPN_COUNT" -gt 0 ]; then
    echo "   ✅ Found $OVPN_COUNT .ovpn files"
else
    echo "   ❌ No .ovpn files found in $CONFIG_DIR"
    echo
    echo "   Download .ovpn configs from your VPN provider:"
    echo "   - ProtonVPN: https://protonvpn.com/support/vpn-config-download/"
    echo "   - NordVPN: https://nordvpn.com/ovpn/"
    echo "   - Mullvad: https://mullvad.net/en/account/#/openvpn-config"
    echo
    echo "   Put them in: $CONFIG_DIR"
    read -p "   Press Enter when ready..."
    
    OVPN_COUNT=$(ls "$CONFIG_DIR"/*.ovpn 2>/dev/null | wc -l || echo 0)
    if [ "$OVPN_COUNT" -eq 0 ]; then
        echo "   ❌ Still no configs. Setup incomplete."
        exit 1
    fi
    echo "   ✅ Found $OVPN_COUNT .ovpn files"
fi
echo

# Check credentials
echo "4. Checking credentials..."
if [ -f "$CREDS_FILE" ]; then
    echo "   ✅ Credentials file exists"
else
    echo "   ❌ No credentials file found"
    echo
    echo "   Get your OpenVPN credentials from your VPN provider:"
    echo "   - ProtonVPN: https://account.protonvpn.com/account#openvpn"
    echo "   - NordVPN: Service credentials in dashboard"
    echo
    read -p "   Enter username: " vpn_user
    read -sp "   Enter password: " vpn_pass
    echo
    
    echo "$vpn_user" > "$CREDS_FILE"
    echo "$vpn_pass" >> "$CREDS_FILE"
    chmod 600 "$CREDS_FILE"
    echo "   ✅ Credentials saved"
fi
echo

# Sudoers setup
echo "5. Setting up passwordless sudo..."
SUDOERS_FILE="/etc/sudoers.d/vpn-rotate"
if sudo test -f "$SUDOERS_FILE"; then
    echo "   ✅ Sudoers already configured"
else
    echo "   Adding sudoers entry..."
    echo "$USER ALL=(ALL) NOPASSWD: /usr/sbin/openvpn, /usr/bin/killall, /bin/kill" | sudo tee "$SUDOERS_FILE" > /dev/null
    sudo chmod 440 "$SUDOERS_FILE"
    echo "   ✅ Sudoers configured"
fi
echo

# Test connection
echo "6. Testing connection..."
read -p "   Test VPN connection now? [Y/n]: " do_test
if [ "${do_test:-y}" != "n" ]; then
    # Pick random config
    CONFIG=$(ls "$CONFIG_DIR"/*.ovpn | shuf -n 1)
    echo "   Connecting to $(basename $CONFIG)..."
    
    sudo openvpn --config "$CONFIG" --auth-user-pass "$CREDS_FILE" --daemon --log /tmp/vpn-test.log
    
    sleep 10
    
    if ip link show tun0 &>/dev/null; then
        NEW_IP=$(curl -s --max-time 10 https://api.ipify.org)
        echo "   ✅ Connected! IP: $NEW_IP"
        
        # Disconnect
        sudo killall openvpn 2>/dev/null
        echo "   Disconnected"
    else
        echo "   ❌ Connection failed"
        echo "   Check /tmp/vpn-test.log for details"
        exit 1
    fi
fi
echo

# Summary
echo "==========================="
echo "✅ Setup complete!"
echo
echo "Config directory: $CONFIG_DIR"
echo "Credentials file: $CREDS_FILE"
echo "Servers available: $OVPN_COUNT"
echo
echo "Usage:"
echo "  python scripts/vpn.py connect"
echo "  python scripts/vpn.py status"
echo "  python scripts/vpn.py rotate"
echo
echo "Or in Python:"
echo "  from scripts.decorator import with_vpn_rotation"
echo
echo "  @with_vpn_rotation(rotate_every=10)"
echo "  def scrape(url):"
echo "      return requests.get(url).json()"
