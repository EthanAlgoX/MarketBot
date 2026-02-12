#!/usr/bin/env bash
set -euo pipefail

# ── Package MarketBot Desktop ──
# Builds the gateway bundle (compiled dist/ + production node_modules),
# compiles the Electron app via electron-vite, and runs electron-builder
# to produce platform-specific installers.
#
# Usage:
#   bash scripts/package-desktop.sh --mac     # macOS DMG + ZIP
#   bash scripts/package-desktop.sh --win     # Windows NSIS + ZIP
#   bash scripts/package-desktop.sh --linux   # Linux AppImage + deb + rpm
#   bash scripts/package-desktop.sh --all     # All platforms

DESKTOP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$DESKTOP_DIR/../.." && pwd)"
BUNDLE_DIR="$DESKTOP_DIR/gateway-bundle"

PLATFORM_FLAGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mac)    PLATFORM_FLAGS+=(--mac dmg zip); shift ;;
    --win)    PLATFORM_FLAGS+=(--win nsis zip); shift ;;
    --linux)  PLATFORM_FLAGS+=(--linux AppImage deb rpm); shift ;;
    --all)    PLATFORM_FLAGS+=(--mac dmg zip --win nsis zip --linux AppImage deb rpm); shift ;;
    *)        echo "Unknown flag: $1"; exit 1 ;;
  esac
done

if [[ ${#PLATFORM_FLAGS[@]} -eq 0 ]]; then
  echo "Usage: $0 --mac | --win | --linux | --all"
  exit 1
fi

echo "================================================"
echo "  MarketBot Desktop Packaging"
echo "================================================"
echo ""

# ── Step 1: Build the MarketBot CLI (TypeScript -> dist/) ──
echo "[1/5] Building MarketBot CLI (pnpm build)..."
(cd "$ROOT_DIR" && pnpm build)

# ── Step 2: Build the Control UI ──
echo "[2/5] Building Control UI (pnpm ui:build)..."
(cd "$ROOT_DIR" && pnpm ui:build)

# ── Step 3: Create the gateway bundle ──
# This is a self-contained directory with everything the gateway needs
# to run: the compiled JS, production node_modules, and the entry script.
echo "[3/5] Creating gateway bundle..."

rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR"

# Copy the compiled dist/ directory.
echo "  Copying dist/..."
cp -R "$ROOT_DIR/dist" "$BUNDLE_DIR/dist"

# Copy the CLI entry point.
echo "  Copying marketbot.mjs..."
cp "$ROOT_DIR/marketbot.mjs" "$BUNDLE_DIR/marketbot.mjs"

# Copy package.json (needed for module resolution and version info).
cp "$ROOT_DIR/package.json" "$BUNDLE_DIR/package.json"

# Copy lockfile to keep dependency resolution reproducible.
if [[ -f "$ROOT_DIR/pnpm-lock.yaml" ]]; then
  cp "$ROOT_DIR/pnpm-lock.yaml" "$BUNDLE_DIR/pnpm-lock.yaml"
fi

# Copy any patches that pnpm applies (some deps need them at runtime).
# Keep this before install so patchedDependencies can resolve correctly.
if [[ -d "$ROOT_DIR/patches" ]]; then
  echo "  Copying patches/..."
  cp -R "$ROOT_DIR/patches" "$BUNDLE_DIR/patches"
fi

# Install production-only dependencies into the bundle.
# Use pnpm in isolated mode to avoid npm override conflicts and workspace coupling.
echo "  Installing production dependencies..."
(cd "$BUNDLE_DIR" && CI=true pnpm install --prod --ignore-scripts --frozen-lockfile --ignore-workspace)

# Copy extensions (channel plugins).
if [[ -d "$ROOT_DIR/extensions" ]]; then
  echo "  Copying extensions/..."
  cp -R "$ROOT_DIR/extensions" "$BUNDLE_DIR/extensions"
fi

# Copy skills directory if present.
if [[ -d "$ROOT_DIR/skills" ]]; then
  echo "  Copying skills/..."
  cp -R "$ROOT_DIR/skills" "$BUNDLE_DIR/skills"
fi

# Report bundle size.
BUNDLE_SIZE=$(du -sh "$BUNDLE_DIR" | awk '{print $1}')
echo "  Gateway bundle size: $BUNDLE_SIZE"

# ── Step 4: Build the Electron app (electron-vite) ──
echo "[4/5] Building Electron app (electron-vite build)..."
(cd "$DESKTOP_DIR" && npx electron-vite build)

# ── Step 5: Package with electron-builder ──
echo "[5/5] Running electron-builder..."
(cd "$DESKTOP_DIR" && CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder "${PLATFORM_FLAGS[@]}")

# ── Done ──
echo ""
echo "================================================"
echo "  Packaging complete!"
echo "  Output: $DESKTOP_DIR/release/"
echo "================================================"
ls -lh "$DESKTOP_DIR/release/" 2>/dev/null || echo "(release directory not yet created)"
