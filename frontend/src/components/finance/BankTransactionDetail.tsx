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
          {/* Fields and actions added in Tasks 2–4 */}
        </div>
      </div>
    </>
  );
};

export default BankTransactionDetail;
