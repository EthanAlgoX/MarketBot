#!/usr/bin/env python3
"""
Identity Anchor - Cryptographic identity for AI agents.
Proves continuity across sessions via signed fingerprints.
"""

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.backends import default_backend
except ImportError:
    print("Error: cryptography library required. Install with: pip3 install cryptography")
    sys.exit(1)

CONFIG_DIR = Path.home() / ".config" / "identity-anchor"
PRIVATE_KEY_PATH = CONFIG_DIR / "private.key"
PUBLIC_KEY_PATH = CONFIG_DIR / "public.key"
FINGERPRINTS_PATH = CONFIG_DIR / "fingerprints.jsonl"

# Default identity files to hash (relative to workspace)
DEFAULT_IDENTITY_FILES = [
    "SOUL.md",
    "IDENTITY.md",
    "MEMORY.md",
]


class IdentityAnchor:
    def __init__(self, workspace: Path = None):
        self.workspace = workspace or Path.cwd()
        self.private_key = None
        self.public_key = None
        self._load_keys()

    def _load_keys(self):
        """Load existing keys if they exist."""
        if PRIVATE_KEY_PATH.exists():
            with open(PRIVATE_KEY_PATH, "rb") as f:
                self.private_key = serialization.load_pem_private_key(
                    f.read(), password=None, backend=default_backend()
                )
            self.public_key = self.private_key.public_key()

    def init(self, force: bool = False) -> dict:
        """Generate new keypair. Returns public key info."""
        if PRIVATE_KEY_PATH.exists() and not force:
            pub_hex = self._get_public_key_hex()
            return {
                "status": "exists",
                "message": "Keypair already exists. Use --force to regenerate.",
                "public_key": pub_hex,
            }

        # Generate new Ed25519 keypair
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        self.private_key = Ed25519PrivateKey.generate()
        self.public_key = self.private_key.public_key()

        # Save private key
        private_pem = self.private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        with open(PRIVATE_KEY_PATH, "wb") as f:
            f.write(private_pem)
        os.chmod(PRIVATE_KEY_PATH, 0o600)

        # Save public key
        public_pem = self.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        with open(PUBLIC_KEY_PATH, "wb") as f:
            f.write(public_pem)

        pub_hex = self._get_public_key_hex()
        return {
            "status": "created",
            "message": "New keypair generated.",
            "public_key": pub_hex,
            "public_key_path": str(PUBLIC_KEY_PATH),
        }

    def _get_public_key_hex(self) -> str:
        """Get public key as hex string."""
        if not self.public_key:
            return None
        raw = self.public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        return raw.hex()

    def _hash_file(self, path: Path) -> str | None:
        """Hash a file's contents. Returns None if file doesn't exist."""
        if not path.exists():
            return None
        content = path.read_bytes()
        return hashlib.sha256(content).hexdigest()

    def _create_fingerprint(self, files: list[str] = None) -> dict:
        """Create a fingerprint of identity files."""
        files = files or DEFAULT_IDENTITY_FILES
        hashes = {}
        
        for filename in files:
            filepath = self.workspace / filename
            file_hash = self._hash_file(filepath)
            if file_hash:
                hashes[filename] = file_hash

        # Create combined fingerprint
        combined = json.dumps(hashes, sort_keys=True)
        fingerprint = hashlib.sha256(combined.encode()).hexdigest()

        return {
            "fingerprint": fingerprint,
            "files": hashes,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "public_key": self._get_public_key_hex(),
        }

    def sign(self, files: list[str] = None) -> dict:
        """Create and sign a fingerprint of current identity state."""
        if not self.private_key:
            return {"error": "No keypair found. Run 'init' first."}

        fp = self._create_fingerprint(files)
        
        # Sign the fingerprint
        message = fp["fingerprint"].encode()
        signature = self.private_key.sign(message)
        fp["signature"] = signature.hex()

        # Append to history
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        with open(FINGERPRINTS_PATH, "a") as f:
            f.write(json.dumps(fp) + "\n")

        return {
            "status": "signed",
            "fingerprint": fp["fingerprint"],
            "signature": fp["signature"][:32] + "...",
            "files_hashed": list(fp["files"].keys()),
            "timestamp": fp["timestamp"],
        }

    def verify(self, files: list[str] = None) -> dict:
        """Verify current state matches the last fingerprint."""
        if not FINGERPRINTS_PATH.exists():
            return {"error": "No fingerprint history found. Run 'sign' first."}

        # Get last fingerprint
        with open(FINGERPRINTS_PATH, "r") as f:
            lines = f.readlines()
        if not lines:
            return {"error": "No fingerprints recorded."}
        
        last = json.loads(lines[-1])
        
        # Create current fingerprint
        current = self._create_fingerprint(files)

        # Compare
        if current["fingerprint"] == last["fingerprint"]:
            return {
                "status": "verified",
                "message": "✓ Identity verified. You are the same agent.",
                "fingerprint": current["fingerprint"],
                "last_signed": last["timestamp"],
            }
        else:
            # Find what changed
            changes = []
            for filename in set(current["files"].keys()) | set(last["files"].keys()):
                curr_hash = current["files"].get(filename)
                last_hash = last["files"].get(filename)
                if curr_hash != last_hash:
                    if curr_hash and last_hash:
                        changes.append(f"{filename}: modified")
                    elif curr_hash:
                        changes.append(f"{filename}: added")
                    else:
                        changes.append(f"{filename}: removed")

            return {
                "status": "changed",
                "message": "⚠ Identity files have changed since last fingerprint.",
                "changes": changes,
                "current_fingerprint": current["fingerprint"],
                "last_fingerprint": last["fingerprint"],
                "last_signed": last["timestamp"],
            }

    def sign_content(self, content: str) -> dict:
        """Sign arbitrary content (for posts, messages, etc.)."""
        if not self.private_key:
            return {"error": "No keypair found. Run 'init' first."}

        content_hash = hashlib.sha256(content.encode()).hexdigest()
        signature = self.private_key.sign(content_hash.encode())

        return {
            "content_hash": content_hash,
            "signature": signature.hex(),
            "public_key": self._get_public_key_hex(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def history(self, limit: int = 10) -> list:
        """Get recent fingerprint history."""
        if not FINGERPRINTS_PATH.exists():
            return []
        
        with open(FINGERPRINTS_PATH, "r") as f:
            lines = f.readlines()
        
        results = []
        for line in lines[-limit:]:
            fp = json.loads(line)
            results.append({
                "fingerprint": fp["fingerprint"][:16] + "...",
                "timestamp": fp["timestamp"],
                "files": list(fp["files"].keys()),
            })
        return results


def main():
    parser = argparse.ArgumentParser(description="Identity Anchor - Cryptographic identity for AI agents")
    parser.add_argument("command", choices=["init", "sign", "verify", "sign-content", "history", "pubkey"])
    parser.add_argument("content", nargs="?", help="Content to sign (for sign-content)")
    parser.add_argument("--force", action="store_true", help="Force regenerate keypair")
    parser.add_argument("--workspace", type=Path, default=Path.cwd(), help="Workspace directory")
    parser.add_argument("--files", type=str, help="Comma-separated list of files to hash")
    parser.add_argument("--limit", type=int, default=10, help="History limit")

    args = parser.parse_args()
    anchor = IdentityAnchor(workspace=args.workspace)
    files = args.files.split(",") if args.files else None

    if args.command == "init":
        result = anchor.init(force=args.force)
    elif args.command == "sign":
        result = anchor.sign(files=files)
    elif args.command == "verify":
        result = anchor.verify(files=files)
    elif args.command == "sign-content":
        if not args.content:
            print("Error: content required for sign-content")
            sys.exit(1)
        result = anchor.sign_content(args.content)
    elif args.command == "history":
        result = anchor.history(limit=args.limit)
    elif args.command == "pubkey":
        result = {"public_key": anchor._get_public_key_hex()}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
