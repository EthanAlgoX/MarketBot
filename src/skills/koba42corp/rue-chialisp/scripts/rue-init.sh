#!/usr/bin/env bash
# Initialize a new Rue project
# Usage: rue-init.sh [project_name]

set -e

PROJECT="${1:-.}"

if [[ "$PROJECT" != "." ]]; then
    mkdir -p "$PROJECT"
    cd "$PROJECT"
fi

# Create project structure
mkdir -p puzzles

# Create main puzzle file
cat > puzzles/main.rue << 'EOF'
fn main() -> String {
    "Hello, world!"
}
EOF

# Create Cargo.toml for Rust integration (optional)
if command -v cargo &>/dev/null; then
    if [[ ! -f "Cargo.toml" ]]; then
        cat > Cargo.toml << 'EOF'
[package]
name = "rue-puzzle"
version = "0.1.0"
edition = "2021"

[dependencies]
chia-wallet-sdk = "0.32"
anyhow = "1"

[dev-dependencies]
sha2 = "0.10"
EOF
    fi
    
    # Create lib.rs template
    mkdir -p src
    cat > src/lib.rs << 'EOF'
use chia_wallet_sdk::prelude::*;

// Define your puzzle arguments (curried values)
#[derive(Debug, Clone, ToClvm, FromClvm)]
#[clvm(curry)]
pub struct PuzzleArgs {
    // Add curried fields here
}

// Define your solution structure
#[derive(Debug, Clone, ToClvm, FromClvm)]
#[clvm(list)]
pub struct PuzzleSolution<T> {
    pub conditions: Conditions<T>,
}

// Compile the Rue puzzle automatically
compile_rue!(PuzzleArgs = PUZZLE_MOD, ".");

#[cfg(test)]
mod tests {
    use super::*;
    use anyhow::Result;

    #[test]
    fn test_puzzle() -> Result<()> {
        let mut ctx = SpendContext::new();
        let mut sim = Simulator::new();

        // Create a test wallet
        let alice = sim.bls(1);
        let alice_p2 = StandardLayer::new(alice.pk);

        // TODO: Add your puzzle test logic here

        Ok(())
    }
}
EOF
fi

echo "Rue project initialized in $(pwd)"
echo ""
echo "Project structure:"
echo "  puzzles/main.rue  - Main puzzle file"
[[ -f "Cargo.toml" ]] && echo "  Cargo.toml        - Rust integration"
[[ -f "src/lib.rs" ]] && echo "  src/lib.rs        - Rust test harness"
echo ""
echo "Next steps:"
echo "  1. Edit puzzles/main.rue"
echo "  2. Run: rue build"
echo "  3. Run: rue test (or cargo test)"
