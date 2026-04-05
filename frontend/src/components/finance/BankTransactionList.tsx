import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import BankTransactionDetail from './BankTransactionDetail';

export interface BankTransaction {
    id: number;
    date: string;
    amount: number;
    description: string;
    type: string;
    status: 'PENDING' | 'MATCHED' | 'IGNORED';
    payer_name: string | null;
    check_number: string | null;
    member?: {
        first_name: string;
        last_name: string;
    };
    suggested_match?: {
        type: string;
        member: {
            id: number;
            first_name: string;
            last_name: string;
        }
    };
    potential_matches?: {
        id: number;
        amount: number;
        payment_date: string;
        member?: {
            first_name: string;
            last_name: string;
        };
    }[];
}

const BankTransactionList: React.FC<{ refreshTrigger: number }> = ({ refreshTrigger }) => {
    const { firebaseUser } = useAuth();
    const { t } = useLanguage();
    const [transactions, setTransactions] = useState<BankTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [searchDescription, setSearchDescription] = useState<string>('');
    const [currentBalance, setCurrentBalance] = useState<number | null>(null);
    const [selectedTxn, setSelectedTxn] = useState<BankTransaction | null>(null);

    // Manual Link & Payment Type Selection (bulk mode)
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [selectedPaymentType, setSelectedPaymentType] = useState('donation');
    const [selectedForYear, setSelectedForYear] = useState<number | ''>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    // Search effect
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (!searchTerm || searchTerm.length < 3) {
                setSearchResults([]);
                return;
            }

            try {
                setSearching(true);
                const token = await firebaseUser?.getIdToken();
                const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

                const res = await fetch(`${apiUrl}/api/members/search?q=${encodeURIComponent(searchTerm)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const data = await res.json();
                if (data.success) {
                    setSearchResults(data.data.results);
                }
            } catch (error) {
                console.error("Search error:", error);
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, firebaseUser]);

    // Multi-select state
    const [selectedTxnIds, setSelectedTxnIds] = useState<number[]>([]);
    const [isBulkMode, setIsBulkMode] = useState(false);

    const paymentTypes = [
        { value: 'donation', label: 'Donation (General)' },
        { value: 'tithe', label: 'Tithe (አስራት)' },
        { value: 'membership_due', label: 'Membership Due (ወርहዊ ክፍያ)' },
        { value: 'offering', label: 'Offering (መባእ)' },
        { value: 'building_fund', label: 'Building Fund (ንሕንጻ)' },
        { value: 'event', label: 'Event / Fundraising (ንበዓል)' },
        { value: 'tigray_hunger_fundraiser', label: 'Tigray Hunger Fundraiser (ረድኤት ንትግራይ)' },
        { value: 'vow', label: 'Vow / Selet (ስለት)' },
        { value: 'religious_item_sales', label: 'Religious Item Sales (ንዋየ ቅድሳት)' },
        { value: 'other', label: 'Other (ሌላ)' },
    ];

    const fetchTransactions = async () => {
        if (!firebaseUser) return;
        try {
            setLoading(true);
            const token = await firebaseUser.getIdToken();
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: '20'
            });
            if (filterStatus) queryParams.append('status', filterStatus);
            if (filterType) queryParams.append('type', filterType);
            if (startDate) queryParams.append('startDate', startDate);
            if (endDate) queryParams.append('endDate', endDate);
            if (searchDescription) queryParams.append('description', searchDescription);

            const res = await fetch(`${apiUrl}/api/bank/transactions?${queryParams}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await res.json();
            if (data.success) {
                setTransactions(data.data.transactions);
                setTotalPages(data.data.pagination.pages);
                setCurrentBalance(data.data.current_balance);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [firebaseUser, page, filterStatus, filterType, startDate, endDate, searchDescription, refreshTrigger]);

    // Global refresh listener
    useEffect(() => {
        const handleRefresh = () => {
            setPage(1); // Reset to first page on refresh
            setSelectedTxnIds([]); // Clear selection on refresh
            fetchTransactions();
        };
        window.addEventListener('bank:refresh', handleRefresh);
        return () => window.removeEventListener('bank:refresh', handleRefresh);
    }, [firebaseUser, filterStatus, filterType, startDate, endDate, searchDescription]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };


    const handleBulkReconcile = async (member: any) => {
        if (selectedTxnIds.length === 0) return;
        if (!window.confirm(`Link ${selectedTxnIds.length} transactions to ${member.name} as ${selectedPaymentType}?`)) return;

        try {
            const token = await firebaseUser?.getIdToken();
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

            const payload: any = {
                transaction_ids: selectedTxnIds,
                member_id: member.id,
                payment_type: selectedPaymentType
            };

            if (selectedForYear) {
                payload.for_year = selectedForYear;
            }

            const res = await fetch(`${apiUrl}/api/bank/reconcile-bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Clear selection
                setSelectedTxnIds([]);
                setIsBulkMode(false);
                setShowLinkModal(false);
                fetchTransactions();
                window.dispatchEvent(new CustomEvent('payments:refresh'));

                if (data.data.errors.length > 0) {
                    alert(`Completed with some errors: ${data.data.errors.length} failed.`);
                }
            } else {
                alert('Failed to bulk reconcile: ' + (data.message || 'Unknown error'));
            }
        } catch (err) {
            console.error(err);
            alert('Error processing bulk reconciliation');
        }
    };

    // --- Modal Logic ---

    return (
        <div className="space-y-4">
            {/* Balance Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <dt className="text-sm font-medium text-gray-500 truncate">Current Bank Balance</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {currentBalance !== null ? formatCurrency(currentBalance) : '---'}
                    </dd>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/80 p-4 xl:flex-row">
                    <h3 className="text-lg font-medium text-gray-900">Bank Transactions</h3>
                    <div className="flex flex-wrap gap-2 items-center">
                        <input
                            type="text"
                            placeholder="Search description..."
                            value={searchDescription}
                            onChange={(e) => setSearchDescription(e.target.value)}
                            className="block w-40 pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                        />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="block w-36 pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                        />
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="block w-36 pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                        />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="block w-32 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                        >
                            <option value="">All Types</option>
                            <option value="ZELLE">{t('zelle')}</option>
                            <option value="CHECK">{t('check')}</option>
                            <option value="ACH">ACH</option>
                            <option value="DEBIT">Debit</option>
                        </select>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="block w-32 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                        >
                            <option value="">All Statuses</option>
                            <option value="PENDING">Pending Review</option>
                            <option value="MATCHED">Matched</option>
                            <option value="IGNORED">Ignored</option>
                        </select>
                        {selectedTxnIds.length > 0 && (
                            <button
                                onClick={() => { setIsBulkMode(true); setSearchTerm(''); setSearchResults([]); setSelectedPaymentType('donation'); setSelectedForYear(''); setShowLinkModal(true); }}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                            >
                                Link {selectedTxnIds.length} Transactions
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-100/80">
                            <tr>
                                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    <input
                                        type="checkbox"
                                        checked={transactions.length > 0 && selectedTxnIds.length === transactions.filter(t => t.status === 'PENDING').length}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                const allPending = transactions.filter(t => t.status === 'PENDING').map(t => t.id);
                                                setSelectedTxnIds(allPending);
                                            } else {
                                                setSelectedTxnIds([]);
                                            }
                                        }}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                </th>
                                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Date</th>
                                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Description</th>
                                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Detected / Suggested</th>
                                <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Amount</th>
                                <th className="px-6 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Status</th>
                                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-6 text-center text-slate-500">Loading...</td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-6 text-center text-slate-500">No transactions found.</td></tr>
                            ) : (
                                transactions.map((txn, index) => (
                                    <tr key={txn.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'} ${txn.status === 'PENDING' ? 'ring-1 ring-inset ring-amber-200 bg-amber-50/60' : ''} hover:bg-blue-50/70 transition-colors`}>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            {txn.status === 'PENDING' && (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTxnIds.includes(txn.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedTxnIds(prev => [...prev, txn.id]);
                                                        } else {
                                                            setSelectedTxnIds(prev => prev.filter(id => id !== txn.id));
                                                        }
                                                    }}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-700">
                                            {txn.date}
                                        </td>
                                        <td className="max-w-xs px-6 py-4 text-sm text-slate-900" title={txn.description}>
                                            <div className="truncate font-medium">{txn.description}</div>
                                            {txn.check_number && <span className="mt-1 inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">{t('check')} #{txn.check_number}</span>}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium">
                                            <div className="text-slate-900">{txn.payer_name || '-'}</div>
                                            {txn.status === 'PENDING' && txn.suggested_match && (
                                                <div className="mt-1 text-xs text-blue-600">
                                                    Suggestion: {txn.suggested_match.member.first_name} {txn.suggested_match.member.last_name}
                                                </div>
                                            )}
                                        </td>
                                        <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-semibold ${txn.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                            {formatCurrency(txn.amount)}
                                            {txn.status === 'PENDING' && txn.potential_matches && txn.potential_matches.length > 0 && (
                                                <div className="mt-1 text-xs font-semibold text-amber-700">
                                                    Potential Duplicate
                                                </div>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-center">
                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold 
                                                ${txn.status === 'MATCHED' ? 'bg-emerald-100 text-emerald-800' :
                                                    txn.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                                                        'bg-slate-100 text-slate-700'}`}>
                                                {txn.status}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                                            <button
                                                onClick={() => setSelectedTxn(txn)}
                                                className={`text-xs px-3 py-1.5 rounded font-semibold border transition-colors ${
                                                    selectedTxn?.id === txn.id
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                                                }`}
                                            >
                                                Details →
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:px-6">
                    <div className="flex-1 flex justify-between sm:justify-end">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="ml-3 relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Manual Link Modal (bulk mode only) */}
            {showLinkModal && isBulkMode && (
                <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowLinkModal(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                            <div>
                                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                    Link Transaction to Member
                                </h3>
                                <div className="mt-2 text-sm text-gray-500">
                                    <div className="mb-4 text-xs bg-blue-50 p-2 rounded text-blue-700">
                                        Select "Membership Due" and specify a Year to apply this payment to a specific year's balance.
                                    </div>
                                    <p className="text-sm text-gray-500 mb-4">
                                        <strong>Linking {selectedTxnIds.length} transactions</strong>
                                    </p>

                                    <div className="mb-4 grid grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="link-payment-type" className="block text-sm font-medium text-gray-700">Payment Type</label>
                                            <select
                                                id="link-payment-type"
                                                value={selectedPaymentType}
                                                onChange={(e) => setSelectedPaymentType(e.target.value)}
                                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                                            >
                                                {paymentTypes.map(type => (
                                                    <option key={type.value} value={type.value}>{type.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {selectedPaymentType === 'membership_due' && (
                                            <div>
                                                <label htmlFor="link-payment-year" className="block text-sm font-medium text-gray-700">Year (Optional)</label>
                                                <select
                                                    id="link-payment-year"
                                                    value={selectedForYear}
                                                    onChange={(e) => setSelectedForYear(e.target.value ? parseInt(e.target.value) : '')}
                                                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                                                >
                                                    <option value="">Default (Auto)</option>
                                                    {(() => {
                                                        const currentYear = new Date().getFullYear();
                                                        // Range: 2025 to (CurrentYear - 1)
                                                        const minYear = 2025;
                                                        const maxYear = currentYear - 1;
                                                        const yearOptions = [];
                                                        for (let y = maxYear; y >= minYear; y--) {
                                                            yearOptions.push(y);
                                                        }
                                                        return yearOptions.map(y => (
                                                            <option key={y} value={y}>{y}</option>
                                                        ));
                                                    })()}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <input
                                        type="text"
                                        placeholder="Search member by name or phone..."
                                        className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        autoFocus
                                    />

                                    {searching && <p className="text-xs text-gray-500 mt-2">Searching...</p>}

                                    <div className="mt-4 max-h-60 overflow-y-auto">
                                        {searchResults.map(member => (
                                            <div
                                                key={member.id}
                                                onClick={() => handleBulkReconcile(member)}
                                                className="cursor-pointer hover:bg-gray-100 p-2 rounded flex justify-between items-center border-b last:border-0"
                                            >
                                                <div>
                                                    <span className="font-medium">{member.name}</span>
                                                    <span className="text-xs text-gray-500 ml-2">{member.phoneNumber}</span>
                                                </div>
                                                <span className="text-blue-600 text-sm font-medium">Select</span>
                                            </div>
                                        ))}
                                        {!searching && searchTerm.length >= 3 && searchResults.length === 0 && (
                                            <p className="text-sm text-gray-500 text-center py-2">No members found.</p>
                                        )}
                                    </div>

                                </div>
                            </div>
                            <div className="mt-5 sm:mt-6">
                                <button
                                    type="button"
                                    className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:text-sm"
                                    onClick={() => setShowLinkModal(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <BankTransactionDetail
                txn={selectedTxn}
                onClose={() => setSelectedTxn(null)}
                onSuccess={() => {
                    setSelectedTxn(null);
                    fetchTransactions();
                    window.dispatchEvent(new CustomEvent('payments:refresh'));
                }}
            />
        </div>
    );
};

export default BankTransactionList;
