import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface BankTransaction {
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

    // Manual Link & Payment Type Selection
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [txnToLink, setTxnToLink] = useState<BankTransaction | null>(null);
    const [matchCandidate, setMatchCandidate] = useState<any>(null); // For Confirm Match
    const [selectedPaymentType, setSelectedPaymentType] = useState('donation');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    const paymentTypes = [
        { value: 'donation', label: 'Donation (General)' },
        { value: 'tithe', label: 'Tithe (አስራት)' },
        { value: 'membership_due', label: 'Membership Due (ወርहዊ ክፍያ)' },
        { value: 'offering', label: 'Offering (መባእ)' },
        { value: 'building_fund', label: 'Building Fund (ንሕንጻ)' },
        { value: 'event', label: 'Event / Fundraising (ንበዓል)' },
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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const handleReconcile = async (txn: BankTransaction, memberId?: number, paymentType: string = 'donation', existingTransactionId?: number) => {
        if (!memberId && !existingTransactionId) return;

        try {
            const token = await firebaseUser?.getIdToken();
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

            const payload: any = {
                transaction_id: txn.id,
                action: 'MATCH'
            };

            if (existingTransactionId) {
                payload.existing_transaction_id = existingTransactionId;
            } else {
                payload.member_id = memberId;
                payload.payment_type = paymentType;
            }

            const res = await fetch(`${apiUrl}/api/bank/reconcile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                fetchTransactions();
            } else {
                alert('Failed to reconcile');
            }
        } catch (err) {
            console.error(err);
        }
    };

    // --- Modal Logic ---

    // Open Confirm Modal (for suggested matches)
    const openConfirmModal = (txn: BankTransaction, candidate: any) => {
        setTxnToLink(txn);
        setMatchCandidate(candidate);
        setSelectedPaymentType('donation'); // Default
        setShowConfirmModal(true);
    };

    const handleConfirmReconcile = async () => {
        if (!txnToLink || !matchCandidate) return;
        await handleReconcile(txnToLink, matchCandidate.member.id, selectedPaymentType);
        setShowConfirmModal(false);
        setTxnToLink(null);
        setMatchCandidate(null);
    };

    const openLinkModal = (txn: BankTransaction) => {
        setTxnToLink(txn);
        setSearchTerm('');
        setSearchResults([]);
        setSelectedPaymentType('donation'); // Default
        setShowLinkModal(true);
    };

    const handleManualReconcile = async (member: any) => {
        if (!txnToLink) return;
        if (!window.confirm(`Link ${txnToLink.description} to ${member.name} as ${selectedPaymentType}?`)) return;

        await handleReconcile(txnToLink, member.id, selectedPaymentType);
        setShowLinkModal(false);
        setTxnToLink(null);
    };

    // Search members
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchTerm.length < 3 || !showLinkModal) {
                setSearchResults([]);
                return;
            }
            if (!firebaseUser) return;

            setSearching(true);
            try {
                const token = await firebaseUser.getIdToken();
                const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
                const res = await fetch(`${apiUrl}/api/members/search?q=${encodeURIComponent(searchTerm)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) {
                    setSearchResults(data.data.results);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setSearching(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm, showLinkModal, firebaseUser]);



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

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-medium text-gray-900">Bank Transactions</h3>
                    <div className="flex space-x-2 flex-wrap gap-y-2">
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
                            <option value="ZELLE">Zelle</option>
                            <option value="CHECK">Check</option>
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
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detected / Suggested</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-4 text-center">Loading...</td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">No transactions found.</td></tr>
                            ) : (
                                transactions.map((txn) => (
                                    <tr key={txn.id} className={txn.status === 'PENDING' ? 'bg-yellow-50' : ''}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {txn.date}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={txn.description}>
                                            {txn.description}
                                            {txn.check_number && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">Check #{txn.check_number}</span>}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium">
                                            <div className="text-gray-900">{txn.payer_name || '-'}</div>
                                            {txn.status === 'PENDING' && txn.suggested_match && (
                                                <div className="text-xs text-blue-600 mt-1">
                                                    Suggestion: {txn.suggested_match.member.first_name} {txn.suggested_match.member.last_name}
                                                </div>
                                            )}
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatCurrency(txn.amount)}
                                            {txn.status === 'PENDING' && txn.potential_matches && txn.potential_matches.length > 0 && (
                                                <div className="text-xs text-orange-600 font-bold mt-1">
                                                    ⚠️ Potential Duplicate
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                ${txn.status === 'MATCHED' ? 'bg-green-100 text-green-800' :
                                                    txn.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-gray-100 text-gray-800'}`}>
                                                {txn.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            {txn.status === 'PENDING' && (
                                                <div className="flex space-x-2">
                                                    {txn.amount < 0 ? (
                                                        <span className="text-gray-400 italic text-xs">Expense</span>
                                                    ) : (
                                                        <>
                                                            {txn.suggested_match ? (
                                                                <button
                                                                    onClick={() => openConfirmModal(txn, txn.suggested_match)}
                                                                    className="text-green-600 hover:text-green-900 font-bold"
                                                                >
                                                                    Confirm Match
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => openLinkModal(txn)}
                                                                    className="text-blue-600 hover:text-blue-900 text-xs border border-blue-600 rounded px-2 py-1"
                                                                >
                                                                    Link Member
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                            {txn.status === 'MATCHED' && txn.member && (
                                                <span className="text-gray-500 text-xs">
                                                    Linked to: {txn.member.first_name} {txn.member.last_name}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                    <div className="flex-1 flex justify-between sm:justify-end">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Manual Link Modal */}
            {showLinkModal && txnToLink && (
                <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowLinkModal(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                            <div>
                                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                    Link Transaction to Member
                                </h3>
                                <div className="mt-2">
                                    <p className="text-sm text-gray-500 mb-4">
                                        Transaction: <strong>{txnToLink.description}</strong><br />
                                        Amount: {formatCurrency(txnToLink.amount)}
                                    </p>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700">Payment Type</label>
                                        <select
                                            value={selectedPaymentType}
                                            onChange={(e) => setSelectedPaymentType(e.target.value)}
                                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                                        >
                                            {paymentTypes.map(type => (
                                                <option key={type.value} value={type.value}>{type.label}</option>
                                            ))}
                                        </select>
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
                                                onClick={() => handleManualReconcile(member)}
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

                                    {/* Potential Matches Section */}
                                    {txnToLink.potential_matches && txnToLink.potential_matches.length > 0 && (
                                        <div className="mt-6 border-t pt-4">
                                            <h4 className="text-sm font-medium text-orange-700 mb-2">Potential System Matches (Prevent Duplicates)</h4>
                                            <div className="bg-orange-50 rounded-md p-2">
                                                {txnToLink.potential_matches.map(pm => (
                                                    <div key={pm.id} className="flex justify-between items-center text-sm py-2 border-b border-orange-200 last:border-0">
                                                        <div>
                                                            <span className="font-bold">{formatCurrency(pm.amount)}</span>
                                                            <span className="mx-2">-</span>
                                                            <span>{pm.payment_date}</span>
                                                            <span className="mx-2">-</span>
                                                            <span className="text-gray-600">{pm.member?.first_name} {pm.member?.last_name}</span>
                                                        </div>
                                                        <button
                                                            onClick={async () => {
                                                                if (window.confirm('Link this bank transaction to the existing system record?')) {
                                                                    await handleReconcile(txnToLink, undefined, undefined, pm.id);
                                                                    setShowLinkModal(false);
                                                                    setTxnToLink(null);
                                                                }
                                                            }}
                                                            className="text-xs bg-white border border-orange-300 text-orange-700 px-2 py-1 rounded hover:bg-orange-100"
                                                        >
                                                            Link to Existing
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
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

            {/* Confirm Match Modal */}
            {showConfirmModal && txnToLink && matchCandidate && (
                <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowConfirmModal(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                            <div>
                                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                    Confirm Match & Payment Type
                                </h3>
                                <div className="mt-2 text-sm text-gray-500">
                                    <p>Transaction: <strong>{txnToLink.description}</strong></p>
                                    <p>Amount: {formatCurrency(txnToLink.amount)}</p>
                                    <p className="mt-2">Match with Member: <strong className="text-gray-900">{matchCandidate.member.first_name} {matchCandidate.member.last_name}</strong></p>

                                    <div className="mt-4">
                                        <label className="block text-sm font-medium text-gray-700">Payment Type</label>
                                        <select
                                            value={selectedPaymentType}
                                            onChange={(e) => setSelectedPaymentType(e.target.value)}
                                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md border"
                                        >
                                            {paymentTypes.map(type => (
                                                <option key={type.value} value={type.value}>{type.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-5 sm:mt-6 flex space-x-3">
                                <button
                                    type="button"
                                    className="flex-1 justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:text-sm"
                                    onClick={() => setShowConfirmModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="flex-1 justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none sm:text-sm"
                                    onClick={handleConfirmReconcile}
                                >
                                    Confirm Match
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BankTransactionList;
