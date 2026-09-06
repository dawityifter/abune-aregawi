import { isVoidMemo } from '../voidMemo';

describe('isVoidMemo', () => {
  it('recognizes a memo that is just the word void', () => {
    expect(isVoidMemo('void')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isVoidMemo('VOID')).toBe(true);
  });

  it('recognizes void alongside the rest of the explanation', () => {
    expect(isVoidMemo('Void - misprinted, reissued as 1594')).toBe(true);
  });

  it('recognizes the past tense', () => {
    expect(isVoidMemo('Check voided at the printer')).toBe(true);
  });

  it('rejects a memo that merely contains void inside another word', () => {
    expect(isVoidMemo('Avoid duplicate payment to this vendor')).toBe(false);
  });

  it('rejects an ordinary memo', () => {
    expect(isVoidMemo('August electric bill')).toBe(false);
  });

  it('treats an empty memo as not void', () => {
    expect(isVoidMemo('')).toBe(false);
  });
});
