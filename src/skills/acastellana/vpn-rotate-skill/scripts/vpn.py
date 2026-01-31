#!/usr/bin/env python3
"""
VPN Controller - Works with any OpenVPN-compatible VPN

Usage:
    from vpn import VPN
    
    vpn = VPN()
    vpn.connect()
    print(vpn.get_ip())
    vpn.rotate()
    vpn.disconnect()
"""

import subprocess
import time
import random
from pathlib import Path
from typing import Optional, List
from contextlib import contextmanager

# Default paths
DEFAULT_CONFIG_DIR = Path.home() / ".vpn" / "servers"
DEFAULT_CREDS_FILE = Path.home() / ".vpn" / "creds.txt"
PID_FILE = Path("/tmp/vpn-rotate.pid")
LOG_FILE = Path("/tmp/vpn-rotate.log")

# Also check ProtonVPN paths as fallback
PROTON_CONFIG_DIR = Path.home() / ".config" / "protonvpn" / "servers"
PROTON_CREDS_FILE = Path.home() / ".config" / "protonvpn" / "creds.txt"


class VPN:
    """
    OpenVPN controller for VPN rotation.
    
    Works with any VPN provider that offers .ovpn config files.
    """
    
    def __init__(
        self,
        config_dir: str = None,
        creds_file: str = None,
        rotate_every: int = 10,
        delay: float = 1.0,
        verbose: bool = True
    ):
        # Find config directory
        if config_dir:
            self.config_dir = Path(config_dir).expanduser()
        elif DEFAULT_CONFIG_DIR.exists():
            self.config_dir = DEFAULT_CONFIG_DIR
        elif PROTON_CONFIG_DIR.exists():
            self.config_dir = PROTON_CONFIG_DIR
        else:
            self.config_dir = DEFAULT_CONFIG_DIR
        
        # Find credentials file
        if creds_file:
            self.creds_file = Path(creds_file).expanduser()
        elif DEFAULT_CREDS_FILE.exists():
            self.creds_file = DEFAULT_CREDS_FILE
        elif PROTON_CREDS_FILE.exists():
            self.creds_file = PROTON_CREDS_FILE
        else:
            self.creds_file = DEFAULT_CREDS_FILE
        
        self.rotate_every = rotate_every
        self.delay = delay
        self.verbose = verbose
        self.request_count = 0
        self._current_server = None
    
    def _log(self, msg: str):
        if self.verbose:
            print(msg)
    
    def _run(self, cmd: List[str]) -> subprocess.CompletedProcess:
        return subprocess.run(cmd, capture_output=True, text=True)
    
    def get_servers(self, country: str = None) -> List[Path]:
        """Get available .ovpn config files."""
        if not self.config_dir.exists():
            return []
        
        if country:
            pattern = f"{country.lower()}*.ovpn"
        else:
            pattern = "*.ovpn"
        
        return list(self.config_dir.glob(pattern))
    
    # =========================================================================
    # Connection
    # =========================================================================
    
    def connect(self, country: str = None, server: str = None) -> bool:
        """
        Connect to VPN.
        
        Args:
            country: Filter servers by country prefix (e.g., "us", "es")
            server: Specific server filename
        """
        # Disconnect existing
        self.disconnect()
        time.sleep(1)
        
        # Pick server
        if server:
            config = self.config_dir / server
        else:
            servers = self.get_servers(country)
            if not servers:
                self._log(f"❌ No servers found in {self.config_dir}")
                return False
            config = random.choice(servers)
        
        if not config.exists():
            self._log(f"❌ Config not found: {config}")
            return False
        
        if not self.creds_file.exists():
            self._log(f"❌ Credentials not found: {self.creds_file}")
            return False
        
        self._log(f"🔌 Connecting to {config.name}...")
        
        # Start OpenVPN
        result = self._run([
            "sudo", "-n", "openvpn",
            "--config", str(config),
            "--auth-user-pass", str(self.creds_file),
            "--daemon",
            "--writepid", str(PID_FILE),
            "--log", str(LOG_FILE)
        ])
        
        if result.returncode != 0 and "password" in result.stderr.lower():
            self._log("❌ sudo requires password. Run setup.sh first.")
            return False
        
        # Wait for connection
        for _ in range(20):
            time.sleep(1)
            if self.is_connected():
                self._current_server = config.name
                ip = self.get_ip()
                self._log(f"✅ Connected! IP: {ip}")
                return True
        
        self._log("❌ Connection timeout")
        return False
    
    def disconnect(self) -> bool:
        """Disconnect VPN."""
        # Kill by PID
        if PID_FILE.exists():
            try:
                pid = PID_FILE.read_text().strip()
                self._run(["sudo", "-n", "kill", pid])
                PID_FILE.unlink(missing_ok=True)
            except:
                pass
        
        # Fallback killall
        self._run(["sudo", "-n", "killall", "openvpn"])
        self._current_server = None
        return True
    
    def rotate(self, country: str = None) -> bool:
        """Rotate to a new server (new IP)."""
        self._log(f"\n🔄 Rotating VPN...")
        self.disconnect()
        time.sleep(2)
        return self.connect(country=country)
    
    # =========================================================================
    # Status
    # =========================================================================
    
    def is_connected(self) -> bool:
        """Check if VPN tunnel is active."""
        result = self._run(["ip", "link", "show", "tun0"])
        return result.returncode == 0 and "UP" in result.stdout
    
    def get_ip(self) -> Optional[str]:
        """Get current public IP."""
        try:
            result = subprocess.run(
                ["curl", "-s", "--max-time", "10", "https://api.ipify.org"],
                capture_output=True, text=True
            )
            return result.stdout.strip() if result.returncode == 0 else None
        except:
            return None
    
    def status(self) -> dict:
        """Get connection status."""
        connected = self.is_connected()
        return {
            "connected": connected,
            "server": self._current_server,
            "ip": self.get_ip() if connected else None,
            "config_dir": str(self.config_dir),
            "servers_available": len(self.get_servers())
        }
    
    # =========================================================================
    # Rate Limiting
    # =========================================================================
    
    def before_request(self):
        """Call before each request. Handles delay and auto-rotation."""
        self.request_count += 1
        
        if self.delay > 0:
            time.sleep(self.delay)
        
        if self.rotate_every > 0 and self.request_count % self.rotate_every == 0:
            self.rotate()
    
    # =========================================================================
    # Context Managers
    # =========================================================================
    
    @contextmanager
    def session(self, country: str = None, disconnect_after: bool = True):
        """Context manager for VPN session."""
        try:
            if not self.is_connected():
                self.connect(country=country)
            yield self
        finally:
            if disconnect_after:
                self.disconnect()
    
    @contextmanager
    def protected(self, country: str = None):
        """Context manager - ensures connected, doesn't disconnect."""
        try:
            if not self.is_connected():
                self.connect(country=country)
            yield self
        finally:
            pass


# =============================================================================
# CLI
# =============================================================================

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="VPN Controller")
    parser.add_argument("action", choices=["connect", "disconnect", "status", "rotate", "ip", "servers"])
    parser.add_argument("-c", "--country", help="Country prefix filter")
    parser.add_argument("-s", "--server", help="Specific server file")
    parser.add_argument("--config-dir", help="Config directory")
    parser.add_argument("--creds", help="Credentials file")
    
    args = parser.parse_args()
    
    vpn = VPN(
        config_dir=args.config_dir,
        creds_file=args.creds
    )
    
    if args.action == "connect":
        vpn.connect(country=args.country, server=args.server)
    
    elif args.action == "disconnect":
        vpn.disconnect()
        print("Disconnected")
    
    elif args.action == "status":
        s = vpn.status()
        for k, v in s.items():
            print(f"{k}: {v}")
    
    elif args.action == "rotate":
        vpn.rotate(country=args.country)
    
    elif args.action == "ip":
        print(vpn.get_ip() or "Unknown")
    
    elif args.action == "servers":
        servers = vpn.get_servers(args.country)
        print(f"Found {len(servers)} servers in {vpn.config_dir}")
        for s in servers[:10]:
            print(f"  - {s.name}")
        if len(servers) > 10:
            print(f"  ... and {len(servers) - 10} more")
