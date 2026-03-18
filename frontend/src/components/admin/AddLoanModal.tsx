import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
}

interface AddLoanModalProps {
  onClose: () => void;
  onLoanAdded: () => void;
}

const AddLoanModal: React.FC<AddLoanModalProps> = ({ onClose, onLoanAdded }) => {
  const { user, firebaseUser } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedMemberName, setSelectedMemberName] = useState('');

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [loanDate, setLoanDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const receiptRequired = paymentMethod === 'cash' || paymentMethod === 'check';

  const fetchMembers = useCallback(async (query: string) => {
    if (!firebaseUser) return;
    try {
      setMemberSearchLoading(true);
      const params = new URLSearchParams();
      params.set('email', user?.email || '');
      if (query) params.set('search', query);
      params.set('limit', '20');
      params.set('page', '1');
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/members/all/firebase?${params}`, {
        headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.data?.members || []);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setMemberSearchLoading(false);
    }
  }, [user?.email, firebaseUser]);

  useEffect(() => { fetchMembers(''); }, [fetchMembers]);

  useEffect(() => {
    if (selectedMemberId) return; // don't re-fetch after selection
    const id = setTimeout(() => fetchMembers(memberSearch.trim()), 300);
    return () => clearTimeout(id);
  }, [memberSearch, fetchMembers, selectedMemberId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedMemberId) { setError('Please select a member'); return; }
    if (!amount || parseFloat(amount) < 1) { setError('Amount must be at least $1.00'); return; }
    if (!paymentMethod) { setError('Please select a payment method'); return; }
    if (receiptRequired && !receiptNumber) { setError('Receipt number is required for cash and check payments'); return; }

    try {
      setLoading(true);
      const token = await firebaseUser?.getIdToken();
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          member_id: selectedMemberId,
          amount: parseFloat(amount),
          payment_method: paymentMethod,
          receipt_number: receiptNumber || undefined,
          loan_date: loanDate,
          notes: notes || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Failed to record loan');
        return;
      }
      onLoanAdded();
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full m-4">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Record Member Loan</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200">
          <p className="text-xs text-amber-800 font-medium">
            This records a liability — NOT a donation. The church must repay this loan in full.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
          )}

          {/* Member Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Member *</label>
            <input
              type="text"
              placeholder="Search by name..."
              value={selectedMemberName || memberSearch}
              onChange={(e) => {
                setSelectedMemberId('');
                setSelectedMemberName('');
                setMemberSearch(e.target.value);
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            {memberSearchLoading && <p className="text-xs text-gray-500 mt-1">Searching...</p>}
            {!selectedMemberId && members.length > 0 && memberSearch && (
              <div className="border border-gray-200 rounded-md mt-1 max-h-40 overflow-y-auto">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedMemberId(String(m.id));
                      setSelectedMemberName(`${m.firstName} ${m.lastName}`);
                      setMemberSearch('');
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0"
                  >
                    {m.firstName} {m.lastName}
                    {m.phoneNumber && <span className="text-gray-400 ml-2">{m.phoneNumber}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-md pl-6 pr-3 py-2 text-sm"
                placeholder="0.00"
              />
            </div>
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

          {/* Loan Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loan Date *</label>
            <input
              type="date"
              value={loanDate}
              onChange={(e) => setLoanDate(e.target.value)}
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
              {loading ? 'Saving...' : 'Record Loan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddLoanModal;
