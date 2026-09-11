import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import PledgeQrCode from './PledgeQrCode';

export type PledgeIntent = 'later' | 'immediate' | 'anonymous';

export interface PledgeIntentSelectorProps {
  signedIn: boolean;
  onChoose: (intent: PledgeIntent) => void;
  onSignIn: () => void;
}

// The explicit question. Pledging and paying used to be two unconnected acts
// separated by a page navigation, a sign-in, and a checkbox; this is where the
// giver says which one they mean.
const PledgeIntentSelector: React.FC<PledgeIntentSelectorProps> = ({
  signedIn, onChoose, onSignIn
}) => {
  const { t } = useI18n();

  const card = 'w-full text-left rounded-lg border border-gray-200 bg-white p-5 ' +
    'hover:border-primary-500 hover:shadow-md transition focus:outline-none ' +
    'focus:ring-2 focus:ring-primary-500';

  return (
    <div className="space-y-4">
      {signedIn ? (
        <>
          <button type="button" className={card} onClick={() => onChoose('later')}>
            <div className="font-semibold text-gray-900">{t('pledge.intent.later.title')}</div>
            <div className="text-sm text-gray-600 mt-1">{t('pledge.intent.later.body')}</div>
          </button>

          <button type="button" className={card} onClick={() => onChoose('immediate')}>
            <div className="font-semibold text-gray-900">{t('pledge.intent.immediate.title')}</div>
            <div className="text-sm text-gray-600 mt-1">{t('pledge.intent.immediate.body')}</div>
          </button>
        </>
      ) : (
        <button type="button" className={card} onClick={onSignIn}>
          <div className="font-semibold text-gray-900">{t('pledge.intent.signIn.title')}</div>
          <div className="text-sm text-gray-600 mt-1">{t('pledge.intent.signIn.body')}</div>
        </button>
      )}

      {/* Available signed out by design: a giver who wants anonymity should not
          have to create an account to give. It is always pledge-and-pay. */}
      <button type="button" className={card} onClick={() => onChoose('anonymous')}>
        <div className="font-semibold text-gray-900">{t('pledge.intent.anonymous.title')}</div>
        <div className="text-sm text-gray-600 mt-1">{t('pledge.intent.anonymous.body')}</div>
      </button>

      {/* For a congregation watching this page on a television. Hidden on
          phones, where it would point at the page already on screen. */}
      <PledgeQrCode />
    </div>
  );
};

export default PledgeIntentSelector;
