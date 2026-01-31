#!/usr/bin/env python3
"""
VPN Rotation Decorator

Usage:
    from decorator import with_vpn_rotation
    
    @with_vpn_rotation(rotate_every=10)
    def scrape(url):
        return requests.get(url).json()
"""

import functools
import sys
from pathlib import Path
from typing import Callable

# Ensure vpn module can be imported
sys.path.insert(0, str(Path(__file__).parent))
from vpn import VPN


def with_vpn_rotation(
    rotate_every: int = 10,
    delay: float = 1.0,
    config_dir: str = None,
    creds_file: str = None,
    country: str = None,
    auto_connect: bool = True,
    verbose: bool = False
):
    """
    Decorator to add VPN rotation to any function.
    
    Args:
        rotate_every: Rotate VPN after N requests
        delay: Seconds between requests
        config_dir: Directory with .ovpn files
        creds_file: Path to credentials file
        country: Filter servers by country prefix
        auto_connect: Connect automatically on first request
        verbose: Print status messages
    
    Example:
        @with_vpn_rotation(rotate_every=10)
        def fetch(url):
            return requests.get(url).json()
        
        # Every 10 calls, VPN rotates to new server
        for url in urls:
            data = fetch(url)
        
        # Cleanup when done
        fetch.cleanup()
    """
    def decorator(func: Callable) -> Callable:
        vpn = VPN(
            config_dir=config_dir,
            creds_file=creds_file,
            rotate_every=rotate_every,
            delay=delay,
            verbose=verbose
        )
        
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Auto-connect if needed
            if auto_connect and not vpn.is_connected():
                vpn.connect(country=country)
            
            # Before request hook (delay + rotation)
            vpn.before_request()
            
            # Call original function
            return func(*args, **kwargs)
        
        # Attach VPN instance and helpers
        wrapper.vpn = vpn
        wrapper.rotate = lambda: vpn.rotate(country=country)
        wrapper.cleanup = vpn.disconnect
        wrapper.status = vpn.status
        wrapper.is_connected = vpn.is_connected
        
        return wrapper
    
    return decorator


def patch_function(
    func: Callable,
    rotate_every: int = 10,
    **kwargs
) -> Callable:
    """
    Wrap an existing function with VPN rotation.
    
    Example:
        import some_module
        some_module.api_call = patch_function(
            some_module.api_call,
            rotate_every=10
        )
    """
    return with_vpn_rotation(rotate_every=rotate_every, **kwargs)(func)


if __name__ == "__main__":
    print("VPN Rotation Decorator")
    print("=" * 40)
    print()
    print("Usage:")
    print("  from decorator import with_vpn_rotation")
    print()
    print("  @with_vpn_rotation(rotate_every=10)")
    print("  def scrape(url):")
    print("      return requests.get(url).json()")
