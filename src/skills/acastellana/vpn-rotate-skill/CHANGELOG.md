# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-01-30

### Added
- Initial release
- VPN class for OpenVPN connection management
- `@with_vpn_rotation` decorator for automatic IP rotation
- `patch_function()` helper to wrap existing functions
- Setup wizard (`setup.sh`) for easy configuration
- Provider guides for ProtonVPN, NordVPN, and Mullvad
- Catastro API example demonstrating rate limit bypass
- CLI interface for manual VPN control
- Context managers (`session`, `protected`) for scoped connections
- Automatic fallback to ProtonVPN config paths
