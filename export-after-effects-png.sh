#!/bin/sh
set -e
cd "$(dirname "$0")"
OUTLINED="$(mktemp -t ae-outlineXXXXXX.svg)"
trap 'rm -f "$OUTLINED"' EXIT
node outline-svg-text.cjs cult-connector-after-effects.svg "$OUTLINED"
exec npx --yes @resvg/resvg-js-cli \
  --text-rendering 1 \
  "$OUTLINED" \
  cult-connector-after-effects.png
