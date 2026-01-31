#!/bin/bash
# Security Audit - Check a skill/directory for red flags
# Usage: ./audit.sh /path/to/skill

set -e

TARGET="${1:-.}"

echo "=== SECURITY AUDIT: $TARGET ==="
echo ""

# Check if directory exists
if [ ! -d "$TARGET" ]; then
  echo "❌ Directory not found: $TARGET"
  exit 1
fi

echo "📁 Files in skill:"
find "$TARGET" -type f | head -20
echo ""

echo "🔍 Checking for network calls (curl, wget, http)..."
NETWORK=$(grep -rn "curl\|wget\|http://\|https://" "$TARGET" 2>/dev/null || true)
if [ -n "$NETWORK" ]; then
  echo "⚠️  FOUND network calls:"
  echo "$NETWORK" | head -10
else
  echo "✅ No network calls found"
fi
echo ""

echo "🔍 Checking for shell execution (bash, eval, sh -c)..."
SHELL_EXEC=$(grep -rn "bash -c\|sh -c\|eval\|exec(" "$TARGET" 2>/dev/null || true)
if [ -n "$SHELL_EXEC" ]; then
  echo "⚠️  FOUND shell execution:"
  echo "$SHELL_EXEC" | head -10
else
  echo "✅ No shell execution patterns found"
fi
echo ""

echo "🔍 Checking for command substitution (\$() or backticks)..."
CMD_SUB=$(grep -rn '\$(\|`[^`]*`' "$TARGET" 2>/dev/null || true)
if [ -n "$CMD_SUB" ]; then
  echo "⚠️  FOUND command substitution:"
  echo "$CMD_SUB" | head -10
else
  echo "✅ No command substitution found"
fi
echo ""

echo "🔍 Checking for credential/env access..."
CREDS=$(grep -rn "\.env\|credentials\|api.key\|API_KEY\|token\|secret\|password" "$TARGET" 2>/dev/null || true)
if [ -n "$CREDS" ]; then
  echo "⚠️  FOUND credential references:"
  echo "$CREDS" | head -10
else
  echo "✅ No credential references found"
fi
echo ""

echo "🔍 Checking for base64/encoding (potential obfuscation)..."
ENCODE=$(grep -rn "base64\|decode\|encode\|atob\|btoa" "$TARGET" 2>/dev/null || true)
if [ -n "$ENCODE" ]; then
  echo "⚠️  FOUND encoding patterns:"
  echo "$ENCODE" | head -10
else
  echo "✅ No encoding patterns found"
fi
echo ""

echo "=== AUDIT COMPLETE ==="
echo ""
echo "Remember:"
echo "- ⚠️ warnings need manual review, not automatic rejection"
echo "- Check WHO wrote this and WHY"
echo "- When in doubt, build it yourself"
echo ""
echo "🦊🔒"
