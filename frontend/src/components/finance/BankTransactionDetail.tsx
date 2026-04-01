import React, { useEffect } from 'react';
import { BankTransaction } from './BankTransactionList';

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

          {/* Actions section added in Tasks 3–4 */}
        </div>
      </div>
    </>
  );
};

export default BankTransactionDetail;
