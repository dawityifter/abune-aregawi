import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

// Crediting a payment to a member and remembering who its sender is are two
// different decisions. A friend paying another member's pledge once must not
// teach the matcher that the friend's future payments are that member's.
// This control asks, whenever the answer would say something new about the
// sender: "this payment only" (paid on behalf of) or "remember".

export interface KnownSender {
  id: number | string;
  first_name?: string | null;
  last_name?: string | null;
}

const words = (value?: string | null) =>
  String(value || '')
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length >= 2);

/**
 * Mirrors the server's payerResemblesMember: some word of the member's first
 * name and some word of their last name appear in the payer name. The display
 * name "First Last" is split into its first and last word.
 */
export function payerResembles(payerName?: string | null, memberName?: string | null): boolean {
  const payer = new Set(words(payerName));
  const parts = String(memberName || '').trim().split(/\s+/);
  if (parts.length < 2) return false;
  return words(parts[0]).some((w) => payer.has(w)) && words(parts[parts.length - 1]).some((w) => payer.has(w));
}

export interface SenderLinkState {
  /** Ask at all: hidden when the sender is already remembered as exactly this member. */
  visible: boolean;
  /** The pre-selected answer; the server's own default makes the same call. */
  defaultRemember: boolean;
  /** Members the sender is currently remembered as, other than the chosen one. */
  others: KnownSender[];
}

export function senderLinkState(
  payerName: string | null | undefined,
  member: { id: number | string; name: string } | null,
  knownAs: KnownSender[]
): SenderLinkState {
  if (!payerName || !member) return { visible: false, defaultRemember: false, others: [] };
  const others = knownAs.filter((m) => String(m.id) !== String(member.id));
  if (knownAs.length > 0 && others.length === 0) return { visible: false, defaultRemember: true, others };
  return {
    visible: true,
    defaultRemember: others.length === 0 && payerResembles(payerName, member.name),
    others
  };
}

interface Props {
  idPrefix: string;
  payerName: string;
  memberName: string;
  others: KnownSender[];
  remember: boolean;
  onChange: (remember: boolean) => void;
}

const fullName = (m: KnownSender) => `${m.first_name || ''} ${m.last_name || ''}`.trim() || `#${m.id}`;

const SenderLinkChoice: React.FC<Props> = ({ idPrefix, payerName, memberName, others, remember, onChange }) => {
  const { t } = useLanguage();
  const name = `${idPrefix}-sender-link`;
  return (
    <fieldset className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <legend className="px-1 text-xs font-bold text-amber-800">{t('zelleReview.senderLink.title')}</legend>
      {others.length > 0 && (
        <p className="mb-2 text-xs text-amber-900">
          {t('zelleReview.senderLink.knownAs', { payer: payerName, known: others.map(fullName).join(', ') })}
        </p>
      )}
      <div className="space-y-1">
        <label htmlFor={`${name}-once`} className="flex items-start gap-2 text-sm text-gray-800">
          <input
            id={`${name}-once`}
            type="radio"
            name={name}
            className="mt-1"
            checked={!remember}
            onChange={() => onChange(false)}
          />
          <span>{t('zelleReview.senderLink.thisPaymentOnly', { payer: payerName, member: memberName })}</span>
        </label>
        <label htmlFor={`${name}-remember`} className="flex items-start gap-2 text-sm text-gray-800">
          <input
            id={`${name}-remember`}
            type="radio"
            name={name}
            className="mt-1"
            checked={remember}
            onChange={() => onChange(true)}
          />
          <span>{t('zelleReview.senderLink.remember', { payer: payerName, member: memberName })}</span>
        </label>
      </div>
      <p className="mt-2 text-xs text-gray-600">{t('zelleReview.senderLink.help')}</p>
    </fieldset>
  );
};

export default SenderLinkChoice;
