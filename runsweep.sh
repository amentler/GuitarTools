#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

read -r -p "Worker count [22]: " worker_input
if [[ -z "${worker_input// }" ]]; then
  worker_count=22
elif [[ "$worker_input" =~ ^[0-9]+$ ]] && (( worker_input >= 1 )); then
  worker_count="$worker_input"
else
  echo "Worker count must be a positive integer." >&2
  exit 1
fi

npm run onsetsweep -- --workers "$worker_count"
