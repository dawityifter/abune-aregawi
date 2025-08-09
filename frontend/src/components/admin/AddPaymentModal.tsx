import React, { useState, useEffect, useCallback } from 'react';
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
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [month, setMonth] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  
  // New transaction fields
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [processStripePayment, setProcessStripePayment] = useState<null | (() => Promise<void>)>(null);

  const fetchMembers = useCallback(async () => {
    if (!firebaseUser) return;
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/all/firebase?email=${encodeURIComponent(user?.email || '')}`, {
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
    }
  }, [user?.email, firebaseUser]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);


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
      let response;

      if (paymentView === 'new') {
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
    { value: 'membership_due', label: 'Membership Due' },
    { value: 'tithe', label: 'Tithe' },
    { value: 'donation', label: 'Donation' },
    { value: 'event', label: 'Event' },
    { value: 'other', label: 'Other' }
  ];

  const transactionPaymentMethods = [
    { value: 'cash', label: 'Cash' },
    { value: 'check', label: 'Check' },
    { value: 'zelle', label: 'Zelle' },
    // Combine Debit and Credit into one UI option; backend expects 'credit_card' or 'debit_card'. Use 'credit_card'.
    { value: 'credit_card', label: 'Debit/Credit Card' },
    { value: 'ach', label: 'ACH' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Member
              </label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a member</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.firstName} {member.lastName} ({member.id})
                  </option>
                ))}
              </select>
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
                {(paymentMethod === 'credit_card' || paymentMethod === 'ach') && selectedMemberId && amount && paymentType && (
                  <div className="mt-2">
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
                            donor_phone: (members.find(m => String(m.id) === String(selectedMemberId))?.phoneNumber) || ''
                          }}
                          purpose={paymentType as any}
                          inline
                          onPaymentReady={(fn) => setProcessStripePayment(() => fn)}
                          onSuccess={() => {
                            onPaymentAdded();
                            onClose();
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
                        purpose={paymentType as any}
                        inline
                        onPaymentReady={(fn) => setProcessStripePayment(() => fn)}
                        onSuccess={() => {
                          onPaymentAdded();
                          onClose();
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
                    Receipt Number
                  </label>
                  <input
                    type="text"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    placeholder="Enter receipt number (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="Enter amount"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
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

            <div className="flex justify-end space-x-3 pt-4">
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
                {loading ? 'Adding...' : 'Add Payment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddPaymentModal; 