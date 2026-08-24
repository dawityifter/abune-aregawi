import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';

export interface PledgeLaterFormProps {
  onSubmit: (data: { amount: string; notes?: string }) => Promise<void>;
  loading: boolean;
}

// Amount and an optional note, nothing else. Identity comes from the auth
// token server-side, so this form never asks for a name, email, or phone —
// asking would invite the mismatch that used to leave member_id null.
const PledgeLaterForm: React.FC<PledgeLaterFormProps> = ({ onSubmit, loading }) => {
  const { t } = useI18n();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value < 1) {
      setError(t('pledgeForm.errors.amountMin'));
      return;
    }
    setError(null);
    await onSubmit({ amount, notes: notes || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-lg shadow p-6">
      <div>
        <label htmlFor="pledge-amount" className="block text-sm font-medium text-gray-700">
          {t('pledgeForm.amountLabel')}
        </label>
        <input
          id="pledge-amount" type="number" min="1" step="0.01" value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>

      <div>
        <label htmlFor="pledge-notes" className="block text-sm font-medium text-gray-700">
          {t('pledgeForm.notesLabel')}
        </label>
        <textarea
          id="pledge-notes" rows={3} value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
      </div>

      <button
        type="submit" disabled={loading}
        className="w-full rounded-md bg-primary-600 px-4 py-2 text-white font-medium disabled:opacity-50"
      >
        {loading ? t('common.submitting') : t('pledge.intent.later.title')}
      </button>
    </form>
  );
};

export default PledgeLaterForm;
