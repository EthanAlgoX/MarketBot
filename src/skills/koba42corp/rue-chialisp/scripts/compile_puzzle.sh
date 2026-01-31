#!/usr/bin/env bash
# Script to compile a Rue puzzle into CLVM bytecode

file=$1

if [[ ! -f "$file" ]]; then
  echo "File $file not found!"
  exit 1
fi

rue build $file && echo "Compiled $file to CLVM bytecode." || echo "Compilation failed."
