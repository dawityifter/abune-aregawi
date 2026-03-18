import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AddLoanModal from './AddLoanModal';
import RecordRepaymentModal from './RecordRepaymentModal';

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
  notes: string | null;
  member: LoanMember;
  collector?: LoanMember;
}

interface LoanStats {
  totalOutstandingBalance: number;
  activeLoansCount: number;
  partiallyRepaidCount: number;
  closedLoansCount: number;
  totalLoanedAmount: number;
  totalRepaidAmount: number;
}

const currency = (n: number | string) =>
  Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const formatMethod = (m: string) =>
  m ? m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    ACTIVE: 'bg-blue-100 text-blue-800',
    PARTIALLY_REPAID: 'bg-yellow-100 text-yellow-800',
    CLOSED: 'bg-green-100 text-green-800'
  };
  return map[status] || 'bg-gray-100 text-gray-800';
};

const LoansPage: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [stats, setStats] = useState<LoanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  const getToken = useCallback(async () => {
    return firebaseUser?.getIdToken();
  }, [firebaseUser]);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const token = await getToken();
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/loans/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.data);
      }
    } catch (err) {
      console.error('Error fetching loan stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [getToken]);

  const fetchLoans = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const params = new URLSearchParams({ page: String(page), size: '20' });
      if (statusFilter) params.set('status', statusFilter);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/loans?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLoans(data.data.loans);
        setTotalPages(data.data.pagination.total_pages);
        setTotalItems(data.data.pagination.total_items);
      }
    } catch (err) {
      console.error('Error fetching loans:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken, page, statusFilter, startDate, endDate]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  const handleDownloadReceipt = async (loanId: number, memberName: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/loans/${loanId}/receipt`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Loan_Receipt_${loanId}_${memberName}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Error downloading receipt:', err);
    }
  };

  const handleLoanAdded = () => {
    setShowAddModal(false);
    fetchLoans();
    fetchStats();
  };

  const handleRepaymentRecorded = () => {
    setSelectedLoan(null);
    fetchLoans();
    fetchStats();
  };

  return (
    <div>
      {/* Stats Bar */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-600 font-medium">Total Outstanding</div>
            <div className="text-2xl font-bold text-red-700">{currency(stats.totalOutstandingBalance)}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-600 font-medium">Active Loans</div>
            <div className="text-2xl font-bold text-blue-700">{stats.activeLoansCount}</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-sm text-yellow-600 font-medium">Partially Repaid</div>
            <div className="text-2xl font-bold text-yellow-700">{stats.partiallyRepaidCount}</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600 font-medium">Total Loaned</div>
            <div className="text-2xl font-bold text-gray-700">{currency(stats.totalLoanedAmount)}</div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
        >
          Record Loan
        </button>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PARTIALLY_REPAID">Partially Repaid</option>
          <option value="CLOSED">Closed</option>
        </select>

        <input
          type="date"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="Start Date"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="End Date"
        />

        <span className="text-sm text-gray-500 ml-auto">{totalItems} loan(s)</span>
      </div>

      {/* Warning banner */}
      <div className="bg-amber-50 border-l-4 border-amber-400 p-3 mb-4 rounded">
        <p className="text-sm text-amber-800 font-medium">
          These are liability records — loans from members. They are NOT donations and NOT tax-deductible.
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loan Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Method</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No loans found</td>
                </tr>
              ) : (
                loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {loan.member ? `${loan.member.first_name} ${loan.member.last_name}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(loan.loan_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{currency(loan.amount)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-red-700">{currency(loan.outstanding_balance)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(loan.status)}`}>
                        {loan.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatMethod(loan.payment_method)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{loan.receipt_number || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {loan.status !== 'CLOSED' && (
                          <button
                            onClick={() => setSelectedLoan(loan)}
                            className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded"
                          >
                            Repayment
                          </button>
                        )}
                        <button
                          onClick={() => handleDownloadReceipt(loan.id, `${loan.member?.first_name}_${loan.member?.last_name}`)}
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
                        >
                          Receipt
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddLoanModal
          onClose={() => setShowAddModal(false)}
          onLoanAdded={handleLoanAdded}
        />
      )}

      {selectedLoan && (
        <RecordRepaymentModal
          loan={selectedLoan}
          onClose={() => setSelectedLoan(null)}
          onRepaymentRecorded={handleRepaymentRecorded}
        />
      )}
    </div>
  );
};

export default LoansPage;
