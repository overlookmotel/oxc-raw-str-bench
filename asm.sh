#!/bin/bash
#
# Dump TurboFan-generated assembly for a version's `deserializeStr`.
#
# Usage: `./asm.sh <version-name>`
#
# Example: `./asm.sh current`

if [ -z "$1" ]; then
  echo "Usage: $0 <version-name>" >&2
  exit 1
fi

node --print-opt-code --print-opt-code-filter='deserializeStr' --code-comments \
  asm.ts "$1" 2>/dev/null \
  | awk '
    /^--- Optimized code ---/ { found = 1 }
    /^--- End code ---/ { if (found) { print; found = 0 } }
    found { print }
  '
