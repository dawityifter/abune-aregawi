'use strict';

/**
 * A voided check still has to be recorded. The check number is consumed — it
 * can never be reused — so leaving it out would open a gap in the checkbook
 * sequence that the skipped-check audit would keep reporting forever. The
 * treasurer records it as an expense for $0.00 and says so in the memo.
 *
 * The memo is the marker because it is where the reason belongs anyway
 * ("Void - misprinted, reissued as 1594"), so no extra field is needed.
 */

/** Matches "void"/"voided" as a whole word, so "avoid" doesn't qualify. */
const VOID_MEMO_PATTERN = /\bvoid(ed)?\b/i;

/** Does this memo mark the entry as a voided check? */
function isVoidMemo(memo) {
  return VOID_MEMO_PATTERN.test(String(memo ?? ''));
}

module.exports = {
  isVoidMemo
};
