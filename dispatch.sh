#!/usr/bin/env bash
# Starts the hourly GHLists workflows through the GitHub API.
# This is the same thing the Cloudflare Worker does; useful as a local fallback
# or for testing before/without deploying the Worker.
set -euo pipefail
cd "$(dirname "$0")"
set -a
source .dev.vars
set +a

repos=(new-wikipedia-articles new-npm-packages new-pypi-packages)
files=(hourly-new-articles.yml hourly-new-packages.yml hourly-new-packages.yml)

failed=0
for i in "${!repos[@]}"; do
  repo=${repos[$i]}
  file=${files[$i]}
  body=$(mktemp)
  status=$(curl -sS -o "$body" -w '%{http_code}' -X POST \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -H "User-Agent: ghlists-dispatcher" \
    "https://api.github.com/repos/GHLists/$repo/actions/workflows/$file/dispatches" \
    -d '{"ref":"main"}')
  if [ "$status" = "204" ]; then
    echo "dispatched $repo"
  else
    echo "FAILED $repo: HTTP $status $(cat "$body")" >&2
    failed=1
  fi
  rm -f "$body"
done
exit "$failed"
