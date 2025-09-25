import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import StripePayment from '../StripePayment';
import ACHPayment from '../ACHPayment';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '../../config/stripe';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  memberId?: string; // Optional since backend might not return this
  phoneNumber: string;
  email: string;
  // Optional address fields if API returns them
  streetLine1?: string;
  postalCode?: string;
}

interface AddPaymentModalProps {
  onClose: () => void;
  onPaymentAdded: () => void;
  paymentView: 'old' | 'new';
}

    const AddPaymentModal: React.FC<AddPaymentModalProps> = ({ onClose, onPaymentAdded, paymentView }) => {
    const { user, firebaseUser } = useAuth();
    console.log('🔍 Current user data:', user);
    console.log('🔍 User member data:', user?.data?.member);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [month, setMonth] = useState('');
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  
  // New transaction fields
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [processStripePayment, setProcessStripePayment] = useState<null | (() => Promise<void>)>(null);

  // Amount input helpers (currency-like)
  const amountPattern = useMemo(() => /^[0-9]*([.][0-9]{0,2})?$/, []);
  const handleAmountChange = (value: string) => {
    if (value === '' || amountPattern.test(value)) {
      setAmount(value);
      setAmountError(null);
    } else {
      setAmountError('Enter a valid amount (numbers only, up to 2 decimals).');
    }
  };

  // Whether receipt number is required (new transaction flow only)
  const receiptRequired = useMemo(() => paymentView === 'new' && (paymentMethod === 'cash' || paymentMethod === 'check'), [paymentView, paymentMethod]);
  const normalizeAmountOnBlur = () => {
    if (!amount) return;
    const num = Number(amount);
    if (Number.isFinite(num)) {
      setAmount(num.toFixed(2));
      setAmountError(null);
    }
  };

  const fetchMembers = useCallback(async (query: string) => {
    if (!firebaseUser) return;
    
    try {
      setMemberSearchLoading(true);
      const params = new URLSearchParams();
      params.set('email', user?.email || '');
      if (query) params.set('search', query);
      params.set('limit', '20');
      params.set('page', '1');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/all/firebase?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${await firebaseUser.getIdToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Fetched members:', data.data);
        console.log('🔍 Members array:', data.data?.members);
        console.log('🔍 First member sample:', data.data?.members?.[0]);
        setMembers(data.data?.members || []);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setMemberSearchLoading(false);
    }
  }, [user?.email, firebaseUser]);

  useEffect(() => {
    // initial fetch first page without search
    fetchMembers('');
  }, [fetchMembers]);

  // Debounced server search
  useEffect(() => {
    const id = setTimeout(() => {
      fetchMembers(memberSearch.trim());
    }, 300);
    return () => clearTimeout(id);
  }, [memberSearch, fetchMembers]);

  // Close modal on Escape for better UX and to avoid feeling "frozen"
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);


  // Default payment date to today's local date (YYYY-MM-DD)
  useEffect(() => {
    if (!paymentDate) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setPaymentDate(`${yyyy}-${mm}-${dd}`);
    }
  }, [paymentDate]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate amount for ALL flows (including Stripe)
      const amt = parseFloat(amount);
      if (!amount || !Number.isFinite(amt) || amt <= 0) {
        setAmountError('Please enter a valid amount greater than $0');
        setLoading(false);
        return;
      }
      let response;

      if (paymentView === 'new') {
        // Enforce receipt number for cash/check per business rule
        if (receiptRequired && !receiptNumber.trim()) {
          setError('Receipt number is required for cash and check payments.');
          setLoading(false);
          return;
        }
        // If treasurer selected Stripe methods, delegate to Stripe components
        if (paymentMethod === 'credit_card' || paymentMethod === 'ach') {
          if (!processStripePayment) {
            setError('Payment form not ready. Please review the card/bank details.');
            return;
          }
          await processStripePayment();
          return;
        }

        // Non-Stripe methods: post transaction directly
        response = await fetch(`${process.env.REACT_APP_API_URL}/api/transactions?email=${encodeURIComponent(user?.email || '')}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await firebaseUser?.getIdToken()}`
          },
          body: JSON.stringify({
            member_id: parseInt(selectedMemberId),
            collected_by: parseInt(user?.id || '1'), // Always use logged-in member
            payment_date: paymentDate,
            amount: parseFloat(amount),
            payment_type: paymentType,
            payment_method: paymentMethod,
            receipt_number: receiptNumber,
            note: notes
          })
        });
      } else {
        // Old payment system
        response = await fetch(`${process.env.REACT_APP_API_URL}/api/payments/${selectedMemberId}/payment?email=${encodeURIComponent(user?.data?.member?.email || '')}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await firebaseUser?.getIdToken()}`
          },
          body: JSON.stringify({
            memberId: selectedMemberId,
            month,
            amount: parseFloat(amount),
            paymentMethod,
            notes
          })
        });
      }

      if (response.ok) {
        try { window.dispatchEvent(new CustomEvent('payments:refresh')); } catch {}
        onPaymentAdded();
        onClose();
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to add payment');
      }
    } catch (error) {
      console.error('Error adding payment:', error);
      setError('Failed to add payment');
    } finally {
      setLoading(false);
    }
  };

  const months = [
    { value: 'january', label: 'January' },
    { value: 'february', label: 'February' },
    { value: 'march', label: 'March' },
    { value: 'april', label: 'April' },
    { value: 'may', label: 'May' },
    { value: 'june', label: 'June' },
    { value: 'july', label: 'July' },
    { value: 'august', label: 'August' },
    { value: 'september', label: 'September' },
    { value: 'october', label: 'October' },
    { value: 'november', label: 'November' },
    { value: 'december', label: 'December' }
  ];

  const paymentMethods = [
    { value: 'Cash', label: 'Cash' },
    { value: 'Check', label: 'Check' },
    { value: 'Online', label: 'Online' }
  ];

  // New transaction payment types and methods
  const transactionPaymentTypes = [
    { value: 'membership_due', label: 'Membership Fee (ናይ አባልነት ኽፍሊት)' },
    { value: 'tithe', label: 'Tithe (አስራት)' },
    // Combine Donation and Other into one UI option mapping to 'donation'
    { value: 'donation', label: 'Other Donation / ካልእ' },
    { value: 'building_fund', label: 'Building Fund (ንሕንጻ ቤተክርስቲያን)' },
    { value: 'offering', label: 'Offering (መባእ)' },
    { value: 'vow', label: 'Vow (ስእለት)' },
    // Removed explicit 'event' and 'other' options from dropdown per request
  ];

  const transactionPaymentMethods = [
    { value: 'cash', label: 'Cash' },
    { value: 'check', label: 'Check' },
    // Combine Debit and Credit into one UI option; backend expects 'credit_card' or 'debit_card'. Use 'credit_card'.
    { value: 'credit_card', label: 'Debit/Credit Card' },
    { value: 'ach', label: 'ACH' },
    { value: 'other', label: 'Other' }
  ];

  // Detect if Stripe publishable key exists at build time
  const hasStripeKey = !!process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;

  return (
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative top-20 mx-auto p-5 border w-full max-w-3xl md:max-w-4xl shadow-lg rounded-md bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Add Payment</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Member
              </label>
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search by name, email, or phone"
                className="w-full px-3 py-2 mb-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>{memberSearchLoading ? 'Loading...' : 'Select a member'}</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.firstName} {member.lastName} ({member.id})
                  </option>
                ))}
              </select>
              {members.length === 20 && (
                <p className="mt-1 text-xs text-gray-500">Showing first 20 results. Refine your search to narrow further.</p>
              )}
            </div>

            {paymentView === 'old' ? (
              // Old payment system fields
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Month
                  </label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select month</option>
                    {months.map((monthOption) => (
                      <option key={monthOption.value} value={monthOption.value}>
                        {monthOption.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select payment method</option>
                    {paymentMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              // New transaction system fields
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Type
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select payment type</option>
                    {transactionPaymentTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select payment method</option>
                    {transactionPaymentMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stripe payment forms when card/ACH selected */}
                {(paymentMethod === 'credit_card' || paymentMethod === 'ach') && (
                  <div className="mt-2 md:col-span-2">
                    {/* Guidance for missing fields */}
                    {(!selectedMemberId || !amount || !paymentType) && (
                      <div className="mb-3 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
                        Please select a member, enter an amount, and choose a payment type to proceed.
                      </div>
                    )}
                    {paymentMethod === 'credit_card' && !hasStripeKey && (
                      <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
                        Card payments are currently unavailable: missing Stripe publishable key. Please set REACT_APP_STRIPE_PUBLISHABLE_KEY and rebuild.
                      </div>
                    )}
                    {paymentMethod === 'credit_card' ? (
                      <Elements stripe={stripePromise}>
                        <StripePayment
                          donationData={{
                            amount: parseFloat(amount || '0'),
                            donation_type: 'one-time',
                            payment_method: 'card',
                            donor_first_name: (members.find(m => String(m.id) === String(selectedMemberId))?.firstName) || '',
                            donor_last_name: (members.find(m => String(m.id) === String(selectedMemberId))?.lastName) || '',
                            donor_email: (members.find(m => String(m.id) === String(selectedMemberId))?.email) || '',
                            donor_phone: (members.find(m => String(m.id) === String(selectedMemberId))?.phoneNumber) || '',
                            donor_address: (members.find(m => String(m.id) === String(selectedMemberId))?.streetLine1) || '',
                            donor_zip_code: (members.find(m => String(m.id) === String(selectedMemberId))?.postalCode) || ''
                          }}
                          purpose={(paymentType as any) || 'donation'}
                          inline
                          onPaymentReady={(fn) => setProcessStripePayment(() => fn)}
                          onSuccess={async (result: any) => {
                            try {
                              const response = await fetch(`${process.env.REACT_APP_API_URL}/api/transactions?email=${encodeURIComponent(user?.email || '')}`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${await firebaseUser?.getIdToken()}`
                                },
                                body: JSON.stringify({
                                  member_id: parseInt(selectedMemberId),
                                  collected_by: parseInt(user?.id || '1'),
                                  payment_date: paymentDate,
                                  amount: parseFloat(amount || '0'),
                                  payment_type: (paymentType as any) || 'donation',
                                  payment_method: 'credit_card',
                                  status: 'succeeded',
                                  external_id: result?.payment_intent_id,
                                  donation_id: result?.donation_id,
                                  receipt_number: receiptNumber,
                                  note: notes
                                })
                              });
                              if (!response.ok) {
                                const data = await response.json().catch(() => ({} as any));
                                throw new Error(data.message || 'Failed to record card transaction');
                              }
                              try { window.dispatchEvent(new CustomEvent('payments:refresh')); } catch {}
                              onPaymentAdded();
                              onClose();
                            } catch (err: any) {
                              setError(err?.message || 'Failed to record card transaction');
                            }
                          }}
                          onError={(msg) => setError(msg)}
                          onCancel={() => {}}
                          onRefreshHistory={() => onPaymentAdded()}
                        />
                      </Elements>
                    ) : (
                      <ACHPayment
                        donationData={{
                          amount: parseFloat(amount || '0'),
                          donation_type: 'one-time',
                          payment_method: 'ach',
                          donor_first_name: (members.find(m => String(m.id) === String(selectedMemberId))?.firstName) || '',
                          donor_last_name: (members.find(m => String(m.id) === String(selectedMemberId))?.lastName) || '',
                          donor_email: (members.find(m => String(m.id) === String(selectedMemberId))?.email) || '',
                          donor_phone: (members.find(m => String(m.id) === String(selectedMemberId))?.phoneNumber) || ''
                        }}
                        purpose={(paymentType as any) || 'donation'}
                        inline
                        onPaymentReady={(fn) => setProcessStripePayment(() => fn)}
                        onSuccess={async (result: any) => {
                          try {
                            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/transactions?email=${encodeURIComponent(user?.email || '')}`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${await firebaseUser?.getIdToken()}`
                              },
                              body: JSON.stringify({
                                member_id: parseInt(selectedMemberId),
                                collected_by: parseInt(user?.id || '1'),
                                payment_date: paymentDate,
                                amount: parseFloat(amount || '0'),
                                payment_type: (paymentType as any) || 'donation',
                                payment_method: 'ach',
                                status: 'pending',
                                external_id: result?.payment_intent_id,
                                donation_id: result?.donation_id,
                                receipt_number: receiptNumber,
                                note: notes
                              })
                            });
                            if (!response.ok) {
                              const data = await response.json().catch(() => ({} as any));
                              throw new Error(data.message || 'Failed to record ACH transaction');
                            }
                            try { window.dispatchEvent(new CustomEvent('payments:refresh')); } catch {}
                            onPaymentAdded();
                            onClose();
                          } catch (err: any) {
                            setError(err?.message || 'Failed to record ACH transaction');
                          }
                        }}
                        onError={(msg) => setError(msg)}
                        onCancel={() => {}}
                        onRefreshHistory={() => onPaymentAdded()}
                      />
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Receipt Number {receiptRequired && <span className="text-red-600">*</span>}
                  </label>
                  <input
                    type="text"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    placeholder={receiptRequired ? 'Enter receipt number (required for Cash/Check)' : 'Enter receipt number (optional)'}
                    required={receiptRequired}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {receiptRequired && (
                    <p className="mt-1 text-xs text-gray-600">Required for Cash and Check payments.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Collected By
                  </label>
                  <input
                    type="text"
                    value={user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName} (${user.id})`
                      : user?.firstName 
                        ? `${user.firstName} (${user.id})`
                        : 'Loading...'
                    }
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 cursor-not-allowed"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                onBlur={normalizeAmountOnBlur}
                required
                aria-required="true"
                aria-invalid={!!amountError}
                placeholder="Enter amount"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {amountError && (
                <p className="mt-1 text-xs text-red-600">{amountError}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add any notes about this payment..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2 flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md"
              >
                {loading
                  ? (paymentView === 'new' && (paymentMethod === 'credit_card' || paymentMethod === 'ach')
                      ? 'Processing...'
                      : 'Adding...')
                  : (paymentView === 'new' && (paymentMethod === 'credit_card' || paymentMethod === 'ach')
                      ? `Pay $${(parseFloat(amount || '0') || 0).toFixed(2)}`
                      : 'Add Payment')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddPaymentModal; 