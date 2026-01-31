#!/usr/bin/env bash
# Script to test a compiled Rue puzzle in simulation

file="$1"

if [[ ! -f "$file" ]]; then
  echo "File $file not found!"
  exit 1
fi

# Example simulation command for testing purposes (adapt with actual logic)
cargo test --manifest-path="$file" && echo "Test simulation of $file successful." || echo "Simulation failed."
