# NordVPN Setup

## 1. Create Account

Sign up at https://nordvpn.com

## 2. Get Service Credentials

1. Go to NordVPN dashboard
2. Navigate to **Services** → **NordVPN**
3. Find **Service credentials (manual setup)**
4. Copy username and password

## 3. Download Configs

1. Go to https://nordvpn.com/ovpn/
2. Download configs for desired countries
3. Recommend: TCP configs for reliability

## 4. Install

```bash
mkdir -p ~/.vpn/servers
mv ~/Downloads/*.ovpn ~/.vpn/servers/

cat > ~/.vpn/creds.txt << EOF
YOUR_SERVICE_USERNAME
YOUR_SERVICE_PASSWORD
EOF
chmod 600 ~/.vpn/creds.txt
```

## 5. Test

```bash
python scripts/vpn.py connect
python scripts/vpn.py status
```
