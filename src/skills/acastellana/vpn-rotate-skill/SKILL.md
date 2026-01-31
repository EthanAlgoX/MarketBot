---
name: vpn-rotate-skill
description: Bypass API rate limits by rotating VPN servers. Works with any OpenVPN-compatible VPN (ProtonVPN, NordVPN, Mullvad, etc.). Automatically rotates to new server every N requests for fresh IPs. Use for high-volume scraping, government APIs, geo-restricted data.
---

# VPN Rotate Skill

Rotate VPN servers to bypass API rate limits. Works with any OpenVPN-compatible VPN.

## Setup

### 1. Run Setup Wizard

```bash
./scripts/setup.sh
```

This will:
- Check OpenVPN is installed
- Help you configure your VPN provider
- Set up passwordless sudo
- Test the connection

### 2. Manual Setup

If you prefer manual setup:

```bash
# Install OpenVPN
sudo apt install openvpn

# Create config directory
mkdir -p ~/.vpn/servers

# Download .ovpn files from your VPN provider
# Put them in ~/.vpn/servers/

# Create credentials file
echo "your_username" > ~/.vpn/creds.txt
echo "your_password" >> ~/.vpn/creds.txt
chmod 600 ~/.vpn/creds.txt

# Enable passwordless sudo for openvpn
echo "$USER ALL=(ALL) NOPASSWD: /usr/sbin/openvpn, /usr/bin/killall" | sudo tee /etc/sudoers.d/openvpn
```

## Usage

### Decorator (Recommended)

```python
from scripts.decorator import with_vpn_rotation

@with_vpn_rotation(rotate_every=10, delay=1.0)
def scrape(url):
    return requests.get(url).json()

# Automatically rotates VPN every 10 calls
for url in urls:
    data = scrape(url)
```

### VPN Class

```python
from scripts.vpn import VPN

vpn = VPN()

# Connect
vpn.connect()
print(vpn.get_ip())  # New IP

# Rotate (disconnect + reconnect to different server)
vpn.rotate()
print(vpn.get_ip())  # Different IP

# Disconnect
vpn.disconnect()
```

### Context Manager

```python
from scripts.vpn import VPN

vpn = VPN()

with vpn.session():
    # VPN connected
    for url in urls:
        vpn.before_request()  # Handles rotation
        data = requests.get(url).json()
# VPN disconnected
```

### CLI

```bash
python scripts/vpn.py connect
python scripts/vpn.py status
python scripts/vpn.py rotate
python scripts/vpn.py disconnect
python scripts/vpn.py ip
```

## Configuration

### Decorator Options

```python
@with_vpn_rotation(
    rotate_every=10,      # Rotate after N requests
    delay=1.0,            # Seconds between requests
    config_dir=None,      # Override config directory
    creds_file=None,      # Override credentials file
    country=None,         # Filter servers by country prefix (e.g., "us")
    auto_connect=True,    # Connect automatically on first request
)
```

### VPN Class Options

```python
VPN(
    config_dir="~/.vpn/servers",
    creds_file="~/.vpn/creds.txt", 
    rotate_every=10,
    delay=1.0,
    verbose=True,
)
```

## Recommended Settings

| API Aggressiveness | rotate_every | delay |
|-------------------|--------------|-------|
| Aggressive (Catastro, LinkedIn) | 5 | 2.0s |
| Standard | 10 | 1.0s |
| Lenient | 20-50 | 0.5s |

## Files

```
vpn-rotate-skill/
├── SKILL.md              # This file
├── README.md             # Overview
├── scripts/
│   ├── vpn.py            # VPN controller
│   ├── decorator.py      # @with_vpn_rotation
│   └── setup.sh          # Setup wizard
├── examples/
│   └── catastro.py       # Spanish property API example
└── providers/
    ├── protonvpn.md      # ProtonVPN setup
    ├── nordvpn.md        # NordVPN setup
    └── mullvad.md        # Mullvad setup
```

## Troubleshooting

### "sudo: a password is required"

Run the setup script or manually add sudoers entry:
```bash
echo "$USER ALL=(ALL) NOPASSWD: /usr/sbin/openvpn, /usr/bin/killall" | sudo tee /etc/sudoers.d/openvpn
```

### Connection fails

1. Check credentials are correct
2. Test manually: `sudo openvpn --config ~/.vpn/servers/server.ovpn --auth-user-pass ~/.vpn/creds.txt`
3. Check VPN provider account is active

### Still getting blocked

1. Lower `rotate_every` (try 5 instead of 10)
2. Increase `delay` (try 2-3 seconds)
3. Check if API blocks VPN IPs entirely

### No .ovpn files

Download from your VPN provider:
- ProtonVPN: https://protonvpn.com/support/vpn-config-download/
- NordVPN: https://nordvpn.com/ovpn/
- Mullvad: https://mullvad.net/en/account/#/openvpn-config
