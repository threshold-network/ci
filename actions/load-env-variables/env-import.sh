#!/usr/bin/env bash
set -euo pipefail
filename=""
while getopts f: flag; do
  case "$flag" in f) filename="$OPTARG";; *) exit 1;; esac
done
[[ -r "$filename" ]] || { echo "Configuration file not found: $filename" >&2; exit 1; }
: "${GITHUB_ENV:?GITHUB_ENV is required}"
validated="$(mktemp)"
trap 'rm -f "$validated"' EXIT
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%$'\r'}"
  [[ -z "$line" || "$line" == \#* ]] && continue
  [[ "$line" =~ ^[a-zA-Z_][a-zA-Z0-9_]*= ]] || { echo "Invalid environment entry" >&2; exit 1; }
  value="${line#*=}"
  [[ -z "$value" || "$value" =~ ^[A-Za-z0-9._:/@+=-]*$ ]] || { echo "Invalid environment entry" >&2; exit 1; }
  printf '%s\n' "$line" >> "$validated"
done < "$filename"
cat "$validated" >> "$GITHUB_ENV"