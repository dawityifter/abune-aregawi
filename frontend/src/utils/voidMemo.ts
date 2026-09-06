/**
 * A voided check still has to be recorded. The check number is consumed — it
 * can never be reused — so leaving it out would open a gap in the checkbook
 * sequence that the skipped-check audit would keep reporting forever. The
 * treasurer records it as an expense for $0.00 and says so in the memo, which
 * is where the reason belongs anyway ("Void - misprinted, reissued as 1594").
 *
 * Mirrors backend/src/utils/voidMemo.js — keep the two in step.
 */

/** Matches "void"/"voided" as a whole word, so "avoid" doesn't qualify. */
const VOID_MEMO_PATTERN = /\bvoid(ed)?\b/i;

/** Does this memo mark the entry as a voided check? */
export function isVoidMemo(memo: string | null | undefined): boolean {
  return VOID_MEMO_PATTERN.test(memo ?? '');
}
