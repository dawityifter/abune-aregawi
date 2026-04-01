import React, { useEffect, useRef, useState } from 'react';
import { BankTransaction } from './BankTransactionList';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  txn: BankTransaction | null;
  onClose: () => void;
  onSuccess: () => void;
}

const BankTransactionDetail: React.FC<Props> = ({ txn, onClose, onSuccess }) => {
  useEffect(() => {
    if (!txn) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [txn, onClose]);

  const { firebaseUser } = useAuth();
  const firebaseUserRef = useRef(firebaseUser);
  firebaseUserRef.current = firebaseUser;
  const [selectedPaymentType, setSelectedPaymentType] = useState('donation');
  const [selectedForYear, setSelectedForYear] = useState<number | ''>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [expenseCategories, setExpenseCategories] = useState<{ gl_code: string; name: string }[]>([]);
  const [expGlCode, setExpGlCode] = useState('');
  const [expPayeeName, setExpPayeeName] = useState(txn?.payer_name || '');
  const [expMemo, setExpMemo] = useState(txn?.description || '');
  const [expLoading, setExpLoading] = useState(false);
  const [expError, setExpError] = useState<string | null>(null);

  const paymentTypes = [
    { value: 'donation', label: 'Donation (General)' },
    { value: 'tithe', label: 'Tithe (አስራት)' },
    { value: 'membership_due', label: 'Membership Due (ወርሃዊ ክፍያ)' },
    { value: 'offering', label: 'Offering (መባእ)' },
    { value: 'building_fund', label: 'Building Fund (ንሕንጻ)' },
    { value: 'event', label: 'Event / Fundraising (ንበዓል)' },
    { value: 'tigray_hunger_fundraiser', label: 'Tigray Hunger Fundraiser (ረድኤት ንትግራይ)' },
    { value: 'vow', label: 'Vow / Selet (ስለት)' },
    { value: 'religious_item_sales', label: 'Religious Item Sales (ንዋየ ቅድሳት)' },
    { value: 'other', label: 'Other (ሌላ)' },
  ];

  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchTerm || searchTerm.length < 3) { setSearchResults([]); return; }
      try {
        setSearching(true);
        const token = await firebaseUser?.getIdToken();
        const res = await fetch(`${apiUrl}/api/members/search?q=${encodeURIComponent(searchTerm)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setSearchResults(data.data.results);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, firebaseUser, apiUrl]);

  useEffect(() => {
    if (!txn || txn.amount >= 0) return;
    (async () => {
      try {
        const token = await firebaseUserRef.current?.getIdToken();
        const res = await fetch(`${apiUrl}/api/expenses/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res?.ok) {
          const data = await res.json();
          setExpenseCategories((data.data || []).filter((c: any) => c.is_active));
        }
      } catch {
        // silently ignore fetch errors (e.g. network unavailable or test env)
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txn?.id, txn?.amount, apiUrl]);

  const handleReconcile = async (memberId: number, paymentType: string = selectedPaymentType) => {
    const token = await firebaseUser?.getIdToken();
    const payload: any = { transaction_id: txn!.id, action: 'MATCH', member_id: memberId, payment_type: paymentType };
    if (selectedForYear) payload.for_year = selectedForYear;
    const res = await fetch(`${apiUrl}/api/bank/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (res.ok) { onSuccess(); onClose(); }
  };

  const handleIgnore = async () => {
    const token = await firebaseUser?.getIdToken();
    const res = await fetch(`${apiUrl}/api/bank/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ transaction_id: txn!.id, action: 'IGNORE' }),
    });
    if (res.ok) { onSuccess(); onClose(); }
  };

  const handleSubmitExpense = async () => {
    if (!expGlCode) return;
    setExpLoading(true);
    try {
      const token = await firebaseUser?.getIdToken();
      const res = await fetch(`${apiUrl}/api/bank/reconcile-expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          transaction_id: txn!.id,
          gl_code: expGlCode,
          payee_name: expPayeeName || undefined,
          memo: expMemo || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to record expense');
      onSuccess();
      onClose();
    } catch (err: any) {
      setExpError(err.message);
    } finally {
      setExpLoading(false);
    }
  };

  if (!txn) return null;

  return (
    <>
      <div
        data-testid="panel-backdrop"
        className="fixed inset-0 bg-black bg-opacity-30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label="Transaction Details"
        className="fixed top-0 right-0 bottom-0 w-96 bg-white shadow-2xl z-50 flex flex-col"
      >
        <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center bg-blue-900">
          <div>
            <p className="font-bold text-white text-sm">Transaction Details</p>
            <p className="text-blue-300 text-xs mt-0.5">#{txn.id}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="text-white bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full w-7 h-7 flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {/* Status badge */}
          <div className="mb-4">
            {txn.status === 'PENDING' && (
              <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">
                PENDING REVIEW
              </span>
            )}
            {txn.status === 'MATCHED' && (
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                MATCHED
              </span>
            )}
            {txn.status === 'IGNORED' && (
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">
                IGNORED
              </span>
            )}
          </div>

          {/* Core fields card */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Date</p>
                <p className="text-sm text-gray-900 font-medium">{txn.date}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Type</p>
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded">
                  {txn.type}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Amount</p>
                <p className={`text-lg font-bold ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(txn.amount)}
                </p>
              </div>
              {txn.payer_name && (
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Payer Name</p>
                  <p className="text-sm text-gray-900 font-medium">{txn.payer_name}</p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 pt-3">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Description</p>
              <p className="text-sm text-gray-900 break-words">{txn.description}</p>
            </div>

            {txn.check_number && (
              <div className="border-t border-gray-200 pt-3">
                <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Check Number</p>
                <p className="text-sm text-gray-900 font-medium">Check #{txn.check_number}</p>
              </div>
            )}
          </div>

          {/* Linked member (MATCHED) */}
          {txn.status === 'MATCHED' && txn.member && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-green-700 font-bold mb-1">Linked Member</p>
              <p className="text-sm text-gray-900 font-semibold">
                {txn.member.first_name} {txn.member.last_name}
              </p>
            </div>
          )}

          {/* Actions — PENDING income */}
          {txn.status === 'PENDING' && txn.amount >= 0 && (
            <div className="border-t border-gray-200 pt-4">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-3">Actions</p>

              {txn.suggested_match && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                  <p className="text-xs text-green-700 font-bold mb-1">Suggested Match Found</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {txn.suggested_match.member.first_name} {txn.suggested_match.member.last_name}
                  </p>
                </div>
              )}

              <div className="mb-3">
                <label htmlFor="detail-payment-type" className="block text-xs font-semibold text-gray-600 mb-1">
                  Payment Type
                </label>
                <select
                  id="detail-payment-type"
                  value={selectedPaymentType}
                  onChange={(e) => setSelectedPaymentType(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  {paymentTypes.map((pt) => (
                    <option key={pt.value} value={pt.value}>{pt.label}</option>
                  ))}
                </select>
              </div>

              {selectedPaymentType === 'membership_due' && (
                <div className="mb-3">
                  <label htmlFor="detail-payment-year" className="block text-xs font-semibold text-gray-600 mb-1">
                    Year (Optional)
                  </label>
                  <select
                    id="detail-payment-year"
                    value={selectedForYear}
                    onChange={(e) => setSelectedForYear(e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Default (Auto)</option>
                    {Array.from({ length: new Date().getFullYear() - 2025 }, (_, i) => new Date().getFullYear() - 1 - i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {txn.suggested_match && (
                  <button
                    onClick={() => handleReconcile(txn.suggested_match!.member.id)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white rounded-md py-2 text-sm font-semibold"
                  >
                    Confirm Match
                  </button>
                )}

                <div>
                  <input
                    type="text"
                    placeholder="Search member by name or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                  {searching && <p className="text-xs text-gray-400 mt-1">Searching...</p>}
                  {searchResults.length > 0 && (
                    <div className="mt-1 border border-gray-200 rounded-md max-h-40 overflow-y-auto">
                      {searchResults.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => handleReconcile(m.id)}
                          className="cursor-pointer hover:bg-gray-50 px-3 py-2 text-sm flex justify-between border-b last:border-0"
                        >
                          <span className="font-medium">{m.name}</span>
                          <span className="text-xs text-gray-400">{m.phoneNumber}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleIgnore}
                  className="w-full border border-gray-200 text-gray-400 hover:bg-gray-50 rounded-md py-2 text-sm"
                >
                  Ignore Transaction
                </button>
              </div>
            </div>
          )}

          {/* Actions — PENDING expense */}
          {txn.status === 'PENDING' && txn.amount < 0 && (
            <div className="border-t border-gray-200 pt-4">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-3">Record as Expense</p>

              {expError && <p className="text-red-600 text-xs mb-3">{expError}</p>}

              <div className="mb-3">
                <label htmlFor="detail-exp-category" className="block text-xs font-semibold text-gray-600 mb-1">
                  Expense Category *
                </label>
                <select
                  id="detail-exp-category"
                  aria-label="Expense Category"
                  value={expGlCode}
                  onChange={(e) => setExpGlCode(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">-- Select category --</option>
                  {expenseCategories.map((c) => (
                    <option key={c.gl_code} value={c.gl_code}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Payee (optional)</label>
                <input
                  type="text"
                  value={expPayeeName}
                  onChange={(e) => setExpPayeeName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="Vendor or payee name"
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Memo (optional)</label>
                <textarea
                  value={expMemo}
                  onChange={(e) => setExpMemo(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              <button
                onClick={handleSubmitExpense}
                disabled={expLoading || !expGlCode}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-md py-2 text-sm font-semibold"
              >
                {expLoading ? 'Saving...' : 'Record Expense'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default BankTransactionDetail;
