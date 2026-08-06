#!/bin/bash
#
# Blocks member PII and credentials from being committed.
#
# Written after two member rosters — 365 people, including baptism names and
# repentance fathers — were found in this repo's public history, where they had
# been readable for about a year. Both had been "removed" by untracking them,
# which leaves the data in every clone forever. The cheapest place to stop that
# is before the commit exists.
#
# Checks staged content only, so it costs nothing on a normal commit.
# Deliberate exception: `git commit --no-verify`, or add a path to ALLOWLIST.

set -uo pipefail

# Paths that legitimately look sensitive but are not: templates, fixtures, and
# this script itself — it necessarily contains the very patterns it searches for.
ALLOWLIST_RE='(env\.example|\.env\.example|env\.template|/__mocks__/|/fixtures/|scripts/check-staged-sensitive\.sh)'

fail=0
note() { printf '  \033[31m%s\033[0m\n' "$*"; }

staged=$(git diff --cached --name-only --diff-filter=ACMR)
[ -z "$staged" ] && exit 0

# ── 1. Filenames that should never be committed ────────────────────────────────
# CSV/XLSX anywhere, plus the member-roster and dotenv shapes this repo has
# actually leaked before.
name_re='(^|/)(members?[-_].*\.(csv|json|md)|church-members.*\.csv|.*\.xlsx?|\.env(\..*)?$)|\.csv$'

while IFS= read -r f; do
  [ -z "$f" ] && continue
  echo "$f" | grep -qE "$ALLOWLIST_RE" && continue
  if echo "$f" | grep -qiE "$name_re"; then
    [ $fail -eq 0 ] && echo "🛑 Blocked — staged files look like member data or secrets:"
    note "$f"
    fail=1
  fi
done <<< "$staged"

# ── 2. Content that looks like a member roster or a live credential ────────────
# Header shapes come from the two files that actually leaked.
content_re='(phone_number.*first_name|first_name.*last_name.*phone|repentance_father|baptism_name.*membership_status)'
secret_re='(BEGIN [A-Z ]*PRIVATE KEY|sk_live_|rk_live_|AKIA[0-9A-Z]{16}|xox[baprs]-|postgres(ql)?://[^:]+:[^@]{8,}@|AIza[0-9A-Za-z_-]{35})'

while IFS= read -r f; do
  [ -z "$f" ] && continue
  echo "$f" | grep -qE "$ALLOWLIST_RE" && continue
  added=$(git diff --cached -U0 -- "$f" | grep '^+' | grep -v '^+++')
  [ -z "$added" ] && continue

  if echo "$added" | grep -qiE "$content_re"; then
    [ $fail -eq 0 ] && echo "🛑 Blocked — staged content looks like a member roster:"
    note "$f  (matched a member-roster column header)"
    fail=1
  fi
  if echo "$added" | grep -qE "$secret_re"; then
    [ $fail -eq 0 ] && echo "🛑 Blocked — staged content looks like a live credential:"
    note "$f  (matched a private key / API key / connection string)"
    fail=1
  fi
done <<< "$staged"

if [ $fail -ne 0 ]; then
  cat <<'MSG'

  Member PII and credentials must not enter git history. Untracking a file
  later does NOT remove it — it stays in every clone that ever fetched it.

  If this is a false positive:
    - add the path to ALLOWLIST_RE in scripts/check-staged-sensitive.sh, or
    - bypass once with:  git commit --no-verify

MSG
  exit 1
fi

exit 0
