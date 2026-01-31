# Mullvad Setup

## 1. Create Account

Sign up at https://mullvad.net (account number only, no email required)

## 2. Download Configs

1. Go to https://mullvad.net/en/account/#/openvpn-config
2. Select platform: **Linux**
3. Select countries
4. Download

## 3. Get Credentials

Mullvad uses your **account number** as both username and password.

## 4. Install

```bash
mkdir -p ~/.vpn/servers
mv ~/Downloads/mullvad_*.conf ~/.vpn/servers/

# Rename to .ovpn
cd ~/.vpn/servers
for f in *.conf; do mv "$f" "${f%.conf}.ovpn"; done

cat > ~/.vpn/creds.txt << EOF
YOUR_ACCOUNT_NUMBER
YOUR_ACCOUNT_NUMBER
EOF
chmod 600 ~/.vpn/creds.txt
```

## 5. Test

```bash
python scripts/vpn.py connect
python scripts/vpn.py status
```

## Pricing

€5/month flat. No tiers, no upsells. Privacy-focused.
