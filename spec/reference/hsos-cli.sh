#!/bin/sh
# hsos: the HSOS command for Claude Code (spec/modules/cli.md, CLI-1).
# Copied unchanged to <linkDir>\bin\hsos by claude-link (LINK-2).
# Sends its arguments to HSOS on this machine and prints the answer.
# Exit codes: 0 done, 1 HSOS refused or the command failed, 2 not in an HSOS terminal or HSOS not reachable.

if [ -z "$HSOS_LINK_PORT" ] || [ -z "$HSOS_LINK_TOKEN" ]; then
  echo "hsos: works only inside an HSOS terminal." >&2
  exit 2
fi

# Each argument becomes one form field a=<argument>, URL-encoded by curl, in order.
n=$#
for arg do
  set -- "$@" --data-urlencode "a=$arg"
done
shift "$n"

out=$(curl --silent --show-error --fail-with-body --max-time 130 \
  --header "Authorization: Bearer $HSOS_LINK_TOKEN" \
  --header "X-HSOS-Terminal: ${HSOS_TERMINAL_ID:-}" \
  --data "v=1" "$@" \
  "http://127.0.0.1:$HSOS_LINK_PORT/cli" 2>/dev/null)
code=$?

[ -n "$out" ] && printf '%s\n' "$out"
case $code in
  0) exit 0 ;;
  22) exit 1 ;;
  *) echo "hsos: HSOS is not reachable (curl exit $code)." >&2; exit 2 ;;
esac
