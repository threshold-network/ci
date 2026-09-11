#!/usr/bin/env bash
set -euo pipefail
[[ "${CONFIG_ENVIRONMENT:-}" =~ ^[a-zA-Z0-9_-]+$ ]] || { echo "Invalid environment name" >&2; exit 1; }
config_file="$ACTION_PATH/../../config/env/$CONFIG_ENVIRONMENT.env"
if [[ -n "${CONFIG_REF:-}" ]]; then
  config_file="$(mktemp)"
  trap 'rm -f "$config_file"' EXIT
  bash "$ACTION_PATH/curl.sh" "$CONFIG_ENVIRONMENT.env" "$CONFIG_REF" "$config_file"
fi
bash "$ACTION_PATH/env-import.sh" -f "$config_file"
