#!/usr/bin/env bash
set -euo pipefail
[[ "$1" =~ ^[a-zA-Z0-9_-]+\.env$ ]] || { echo "Invalid config filename" >&2; exit 1; }
curl --proto '=https' --tlsv1.2 --fail --show-error --silent --location --retry 3 \
  --header 'Accept: application/vnd.github.raw+json' \
  --get --data-urlencode "ref=$2" \
  --output "$3" \
  "https://api.github.com/repos/threshold-network/ci/contents/config/env/$1"
