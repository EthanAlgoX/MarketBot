#!/usr/bin/env bash
# Rue environment checker and installer
# Usage: source rue-check.sh && rue_check

rue_check() {
    local missing=()
    
    # Check Rust
    if ! command -v cargo &>/dev/null; then
        missing+=("rust")
        echo "❌ Rust toolchain not found"
    else
        echo "✓ Rust: $(cargo --version)"
    fi
    
    # Check Rue CLI
    if ! command -v rue &>/dev/null; then
        missing+=("rue")
        echo "❌ Rue CLI not found"
    else
        echo "✓ Rue: $(rue --version 2>/dev/null || echo 'installed')"
    fi
    
    # Check clvm_tools_rs
    if ! command -v run &>/dev/null && ! command -v brun &>/dev/null; then
        missing+=("clvm_tools")
        echo "❌ clvm_tools_rs not found"
    else
        echo "✓ clvm_tools_rs: installed"
    fi
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        echo ""
        echo "Missing dependencies. Install with:"
        for dep in "${missing[@]}"; do
            case "$dep" in
                rust)
                    echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
                    ;;
                rue)
                    echo "  cargo install rue-cli"
                    ;;
                clvm_tools)
                    echo "  cargo install clvm_tools_rs"
                    ;;
            esac
        done
        return 1
    fi
    
    echo ""
    echo "✓ All dependencies satisfied"
    return 0
}

rue_install() {
    echo "Installing Rue development environment..."
    
    # Install Rust if needed
    if ! command -v cargo &>/dev/null; then
        echo "Installing Rust toolchain..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env"
    fi
    
    # Install Rue CLI
    if ! command -v rue &>/dev/null; then
        echo "Installing Rue CLI..."
        cargo install rue-cli
    fi
    
    # Install clvm_tools_rs
    if ! command -v brun &>/dev/null; then
        echo "Installing clvm_tools_rs..."
        cargo install clvm_tools_rs
    fi
    
    echo "Installation complete!"
    rue_check
}

# If run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    rue_check
fi
