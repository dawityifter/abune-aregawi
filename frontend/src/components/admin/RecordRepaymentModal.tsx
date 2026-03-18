import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface LoanMember {
  id: number;
  first_name: string;
  last_name: string;
}

interface Loan {
  id: number;
  member_id: number;
  amount: string;
  outstanding_balance: string;
  payment_method: string;
  receipt_number: string | null;
  loan_date: string;
  status: 'ACTIVE' | 'PARTIALLY_REPAID' | 'CLOSED';
  member: LoanMember;
}

interface RecordRepaymentModalProps {
  loan: Loan;
  onClose: () => void;
  onRepaymentRecorded: () => void;
}

const currency = (n: number | string) =>
  Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const RecordRepaymentModal: React.FC<RecordRepaymentModalProps> = ({ loan, onClose, onRepaymentRecorded }) => {
  const { firebaseUser } = useAuth();

  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [repaymentDate, setRepaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const outstanding = parseFloat(loan.outstanding_balance);
  const receiptRequired = paymentMethod === 'cash' || paymentMethod === 'check';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amount = parseFloat(repaymentAmount);
    if (!repaymentAmount || !Number.isFinite(amount) || amount <= 0) {
      setError('Repayment amount must be a positive number');
      return;
    }
    if (amount > outstanding) {
      setError(`Repayment amount (${currency(amount)}) cannot exceed outstanding balance (${currency(outstanding)})`);
      return;
    }
    if (!paymentMethod) { setError('Please select a payment method'); return; }
    if (receiptRequired && !receiptNumber) {
      setError('Receipt number is required for cash and check payments');
      return;
    }

    try {
      setLoading(true);
      const token = await firebaseUser?.getIdToken();
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/loans/${loan.id}/repayments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          repayment_amount: amount,
          payment_method: paymentMethod,
          receipt_number: receiptNumber || undefined,
          repayment_date: repaymentDate,
          notes: notes || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Failed to record repayment');
        return;
      }
      onRepaymentRecorded();
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const memberName = loan.member ? `${loan.member.first_name} ${loan.member.last_name}` : '—';

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full m-4">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Record Loan Repayment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
          )}

          {/* Loan summary */}
          <div className="bg-gray-50 rounded-md p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Member:</span>
              <span className="font-medium">{memberName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Original Amount:</span>
              <span className="font-medium">{currency(loan.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Outstanding Balance:</span>
              <span className="font-semibold text-red-700">{currency(loan.outstanding_balance)}</span>
            </div>
          </div>

          {/* Repayment Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={outstanding}
                value={repaymentAmount}
                onChange={(e) => setRepaymentAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-md pl-6 pr-3 py-2 text-sm"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Max: {currency(outstanding)}</p>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select method...</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="zelle">Zelle</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Receipt Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Receipt / Check Number {receiptRequired ? '*' : ''}
            </label>
            <input
              type="text"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder={receiptRequired ? 'Required for cash/check' : 'Optional'}
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Date *</label>
            <input
              type="date"
              value={repaymentDate}
              onChange={(e) => setRepaymentDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="Optional notes..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Record Repayment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordRepaymentModal;
