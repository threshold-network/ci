#!/usr/bin/env bash
set -euo pipefail
[[ "$1" =~ ^[a-zA-Z0-9_-]+\.env$ ]] || { echo "Invalid config filename" >&2; exit 1; }

# Build curl args array
curl_args=(
  --proto '=https'
  --tlsv1.2
  --fail
  --show-error
  --silent
  --location
  --retry 3
  --header 'Accept: application/vnd.github.raw+json'
  --get
  --data-urlencode "ref=$2"
  --output "$3"
)

# Add Authorization header if GITHUB_TOKEN is set and non-empty
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  curl_args+=(--header "Authorization: Bearer ${GITHUB_TOKEN}")
fi

curl "${curl_args[@]}" "https://api.github.com/repos/threshold-network/ci/contents/config/env/$1"