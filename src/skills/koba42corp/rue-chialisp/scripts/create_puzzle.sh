#!/usr/bin/env bash
# Script to create a Rue puzzle

type=$1
name=""

case "$type" in
  password)
    name="password_puzzle"
    ;;
  signature)
    name="signature_puzzle"
    ;;
  *)
    echo "Unsupported puzzle type"
    exit 1
    ;;
esac

mkdir -p puzzles
cat <<EOF >> puzzles/
$name.rue
fn main() -> String {
  "This is a $type puzzle"
}
EOF

echo "Created $name.rue"
