#!/usr/bin/env bash
# Create a new Rue puzzle from template
# Usage: rue-new.sh <type> [name]
# Types: password, signature, delegated, hello

set -e

TYPE="${1:-hello}"
NAME="${2:-main}"
PUZZLES_DIR="${3:-puzzles}"

mkdir -p "$PUZZLES_DIR"

case "$TYPE" in
    hello)
        cat > "$PUZZLES_DIR/$NAME.rue" << 'EOF'
fn main() -> String {
    "Hello, world!"
}
EOF
        ;;
        
    password)
        cat > "$PUZZLES_DIR/$NAME.rue" << 'EOF'
// Password Puzzle - Educational only, not secure for production
// Locks coins with a SHA-256 hashed password

fn main(
    password_hash: Bytes32,
    password: String,
    conditions: List<Condition>,
) -> List<Condition> {
    // Verify the password matches the hash
    assert sha256(password) == password_hash;
    
    // Return the conditions if password is correct
    conditions
}

// Test function
test fn verify_password() {
    let hash = sha256("secret");
    // Would test with simulator
}
EOF
        ;;
        
    signature)
        cat > "$PUZZLES_DIR/$NAME.rue" << 'EOF'
// Signature Puzzle - Secure for production
// Locks coins with a BLS public key, requires signature to spend

fn main(
    public_key: PublicKey,
    conditions: List<Condition>,
) -> List<Condition> {
    // Create AGG_SIG_ME condition requiring signature on conditions hash
    let agg_sig = AggSigMe {
        public_key,
        message: tree_hash(conditions),
    };
    
    // Prepend signature requirement to conditions
    [agg_sig, ...conditions]
}
EOF
        ;;
        
    delegated)
        cat > "$PUZZLES_DIR/$NAME.rue" << 'EOF'
// Delegated Puzzle - Flexible inner puzzle signing
// Signs an arbitrary puzzle hash for maximum flexibility

fn main(
    public_key: PublicKey,
    delegated_puzzle: fn(...solution: Any) -> List<Condition>,
    delegated_solution: Any,
) -> List<Condition> {
    // Sign the delegated puzzle hash (not the conditions)
    let agg_sig = AggSigMe {
        public_key,
        message: tree_hash(delegated_puzzle),
    };
    
    // Execute delegated puzzle to get conditions
    let conditions = delegated_puzzle(...delegated_solution);
    
    // Prepend signature requirement
    [agg_sig, ...conditions]
}
EOF
        ;;
        
    custom)
        cat > "$PUZZLES_DIR/$NAME.rue" << 'EOF'
// Custom Puzzle Template
// Modify this to create your own puzzle logic

struct PuzzleArgs {
    // Add curried arguments here
}

fn main(
    // Add solution parameters here
    conditions: List<Condition>,
) -> List<Condition> {
    // Add puzzle logic here
    
    conditions
}
EOF
        ;;
        
    *)
        echo "Unknown puzzle type: $TYPE"
        echo "Available types: hello, password, signature, delegated, custom"
        exit 1
        ;;
esac

echo "Created $PUZZLES_DIR/$NAME.rue ($TYPE puzzle)"
