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
#
# Exempt by VALUE, not by path. A filename entry here switches off BOTH the roster
# scan and the live-credential scan for that file, forever, and needs one new entry
# per future test — which is how a guard quietly stops guarding. Test fixtures are
# exempted instead by RESERVED_PHONE_RE below, on the content of the line.
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

# Phone numbers in the block reserved for fiction: 555-0100 through 555-0199, the
# only range the NANPA sets aside as guaranteed-unassignable. A line carrying one
# is by construction not a real member, so drop those lines before the roster scan
# — the same move PLACEHOLDER_RE makes for the secret scan, for the same reason: a
# guard that forces --no-verify every time someone writes a test fixture is a guard
# that gets switched off.
#
# Note 555 as an AREA code (+1555...) is unassignable but is NOT this range, and is
# not exempted: only the 555-01xx line number counts.
RESERVED_PHONE_RE='555-?01[0-9][0-9]([^0-9]|$)'

# Values that are self-evidently not real. Kept deliberately narrow: anything
# looser starts excusing actual secrets.
PLACEHOLDER_RE='(CHANGE_?ME|YOUR_|your_|<[a-z-]+>|xxxx|placeholder|example\.com|EXAMPLE|dummy|REPLACE|\.\.\.)'
secret_re='(BEGIN [A-Z ]*PRIVATE KEY|sk_live_|rk_live_|AKIA[0-9A-Z]{16}|xox[baprs]-|postgres(ql)?://[^:]+:[^@]{8,}@|AIza[0-9A-Za-z_-]{35})'

while IFS= read -r f; do
  [ -z "$f" ] && continue
  echo "$f" | grep -qE "$ALLOWLIST_RE" && continue
  added=$(git diff --cached -U0 -- "$f" | grep '^+' | grep -v '^+++')
  [ -z "$added" ] && continue

  roster=$(echo "$added" | grep -vE "$RESERVED_PHONE_RE")
  if echo "$roster" | grep -qiE "$content_re"; then
    [ $fail -eq 0 ] && echo "🛑 Blocked — staged content looks like a member roster:"
    note "$f  (matched a member-roster column header)"
    fail=1
  fi
  # Setup docs and compose files legitimately contain connection strings with
  # obvious placeholders in them. Drop those lines before the secret scan so
  # writing a runbook does not require bypassing the guard — which is how
  # guards get switched off for real.
  real=$(echo "$added" | grep -viE "$PLACEHOLDER_RE")
  if echo "$real" | grep -qE "$secret_re"; then
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
    - test fixtures: use a phone number in the reserved fictional block,
      555-0100 through 555-0199 (e.g. +15555550100), which this guard skips, or
    - add the path to ALLOWLIST_RE in scripts/check-staged-sensitive.sh — last
      resort, it disables the credential scan on that path too, or
    - bypass once with:  git commit --no-verify

MSG
  exit 1
fi

exit 0
