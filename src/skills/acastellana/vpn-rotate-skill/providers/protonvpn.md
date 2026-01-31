# ProtonVPN Setup

## 1. Create Account

Sign up at https://protonvpn.com (Free tier works, Plus recommended)

## 2. Get OpenVPN Credentials

1. Go to https://account.protonvpn.com/account#openvpn
2. Copy your **OpenVPN username** (looks like: `AbCdEfGhIjKlMnOpQrStUvWx`)
3. Copy your **OpenVPN password**

⚠️ These are NOT your ProtonVPN login credentials!

## 3. Download Configs

1. Go to https://protonvpn.com/support/vpn-config-download/
2. Select platform: **GNU/Linux**
3. Select protocol: **TCP** (more reliable)
4. Download configs for desired countries

## 4. Install

```bash
# Create directory
mkdir -p ~/.vpn/servers

# Move downloaded .ovpn files
mv ~/Downloads/*.ovpn ~/.vpn/servers/

# Create credentials file
cat > ~/.vpn/creds.txt << EOF
YOUR_OPENVPN_USERNAME
YOUR_OPENVPN_PASSWORD
EOF
chmod 600 ~/.vpn/creds.txt
```

## 5. Test

```bash
cd /path/to/vpn-rotate-skill
python scripts/vpn.py connect
python scripts/vpn.py status
python scripts/vpn.py disconnect
```

## Pricing

| Plan | Servers | Speed | Price |
|------|---------|-------|-------|
| Free | 100+ in 3 countries | Medium | €0 |
| Plus | 1900+ in 65+ countries | Fast | €4-10/mo |

Plus recommended for serious scraping.
