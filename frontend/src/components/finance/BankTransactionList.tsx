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

    // Member Search Logic
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length < 3) {
                setSearchResults([]);
                return;
            }

            setSearching(true);
            try {
                const token = await firebaseUser?.getIdToken();
                const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
                const res = await fetch(`${apiUrl}/api/members/search?q=${encodeURIComponent(searchTerm)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) {
                    setSearchResults(data.data);
                }
            } catch (err) {
                console.error("Search failed", err);
            } finally {
                setSearching(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, firebaseUser]);

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
            fetchTransactions();
        };
        window.addEventListener('bank:refresh', handleRefresh);
        return () => window.removeEventListener('bank:refresh', handleRefresh);
    }, [firebaseUser, filterStatus, filterType, startDate, endDate, searchDescription]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    // Batch Selection Logic
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [batchLoading, setBatchLoading] = useState(false);

    const toggleSelection = (id: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === transactions.filter(t => t.status === 'PENDING').length && selectedIds.size > 0) {
            setSelectedIds(new Set());
        } else {
            const pendingIds = transactions.filter(t => t.status === 'PENDING').map(t => t.id);
            setSelectedIds(new Set(pendingIds));
        }
    };

    const handleBatchReconcile = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Are you sure you want to reconcile ${selectedIds.size} transactions? This will attempt to auto-match using suggestions or default to 'donation'.`)) return;

        setBatchLoading(true);
        try {
            const token = await firebaseUser?.getIdToken();
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

            const items = Array.from(selectedIds).map(id => {
                const txn = transactions.find(t => t.id === id);
                if (!txn) return null;

                const payload: any = { transaction_id: id };
                if (txn.suggested_match) {
                    payload.member_id = txn.suggested_match.member.id;
                    payload.payment_type = txn.suggested_match.type || 'donation';
                } else {
                    // No match? We can't really reconcile without a member unless we want to mark it as... processed?
                    // Or maybe we just send it and let backend fail/default?
                    // Currently checking backend logic: logic says "Either Member ID or Manual Donor Name must be provided."
                    // So if we send just ID, it will fail.
                    // Filter out items without suggestion?
                    // Or maybe for batch, we ONLY process suggested matches?
                    // Let's assume for now we only process ones with suggestions OR we error out?
                    // Let's send what we have. If backend fails, the batch fails.
                }
                // Determine 'donation' default if missing
                if (!payload.payment_type) payload.payment_type = 'donation';

                return payload;
            }).filter(p => p !== null);

            // Filter out items that are invalid (no member_id and no manual donor)
            // Ideally we tell user "X items skipped due to no match".
            const validItems = items.filter(i => i.member_id || i.manual_donor_name);

            if (validItems.length === 0) {
                alert("No valid matches found in selection. Please link members manually first or ensure suggestions exist.");
                setBatchLoading(false);
                return;
            }

            if (validItems.length < items.length) {
                if (!window.confirm(`Only ${validItems.length} of ${items.length} selected items have suggested matches. Proceed with valid ones?`)) {
                    setBatchLoading(false);
                    return;
                }
            }

            const res = await fetch(`${apiUrl}/api/bank/reconcile/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ items: validItems })
            });

            if (res.ok) {
                alert(`Successfully processed ${validItems.length} transactions.`);
                setSelectedIds(new Set());
                fetchTransactions();
                window.dispatchEvent(new CustomEvent('payments:refresh'));
            } else {
                const err = await res.json();
                alert(`Batch failed: ${err.message || 'Unknown error'}`);
            }
        } catch (err) {
            console.error(err);
            alert("Error processing batch.");
        } finally {
            setBatchLoading(false);
        }
    };

    // Updated Link Modal State
    const [manualDonorName, setManualDonorName] = useState('');
    const [manualDonorType, setManualDonorType] = useState('Individual');
    const [manualMode, setManualMode] = useState(false);

    const openLinkModal = (txn: BankTransaction) => {
        setTxnToLink(txn);
        setSearchTerm('');
        setSearchResults([]);
        setSelectedPaymentType('donation');
        setManualMode(false);
        setManualDonorName('');
        setManualDonorType('Individual');
        setShowLinkModal(true);
    };

    const handleLinkSubmit = async () => {
        if (!txnToLink) return;

        // Manual Mode
        if (manualMode) {
            if (!manualDonorName.trim()) {
                alert("Please enter a donor name.");
                return;
            }
            if (!window.confirm(`Link ${txnToLink.description} to Manual Donor '${manualDonorName}' (${manualDonorType}) as ${selectedPaymentType}?`)) return;

            await handleReconcile(txnToLink, undefined, selectedPaymentType, undefined, manualDonorName, manualDonorType);
            setShowLinkModal(false);
            setTxnToLink(null);
            return;
        }

        // Member Search Mode (handled by onClick in list)
    };

    const handleReconcile = async (txn: BankTransaction, memberId?: number, paymentType: string = 'donation', existingTransactionId?: number, manualDonor?: string, manualDonorType?: string) => {
        if (!memberId && !existingTransactionId && !manualDonor) return;

        try {
            const token = await firebaseUser?.getIdToken();
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

            const payload: any = {
                transaction_id: txn.id,
                payment_type: paymentType
            };

            if (existingTransactionId) {
                payload.existing_transaction_id = existingTransactionId;
            } else if (memberId) {
                payload.member_id = memberId;
            } else if (manualDonor) {
                payload.manual_donor_name = manualDonor;
                payload.manual_donor_type = manualDonorType || 'Individual';
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
                window.dispatchEvent(new CustomEvent('payments:refresh'));
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

    const handleManualReconcile = (member: any) => {
        if (!txnToLink) return;

        // Prepare matched candidate for confirmation modal
        // Note: Search results use camelCase (firstName), but ConfirmModal expects snake_case (first_name)
        setMatchCandidate({
            member: {
                id: member.id,
                first_name: member.firstName,
                last_name: member.lastName
            }
        });

        // Switch from Link Modal to Confirm Modal
        setShowLinkModal(false);
        setShowConfirmModal(true);
    };

    return (
        <div className="space-y-4">
            {/* ... (Balance Card Omitted for brevity in edit, keeping existing) ... */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <dt className="text-sm font-medium text-gray-500 truncate">Current Bank Balance</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">
                        {currentBalance !== null ? formatCurrency(currentBalance) : '---'}
                    </dd>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-wrap gap-4">
                    <div className="flex items-center space-x-4">
                        <h3 className="text-lg font-medium text-gray-900">Bank Transactions</h3>
                        {selectedIds.size > 0 && (
                            <button
                                onClick={handleBatchReconcile}
                                disabled={batchLoading}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                            >
                                {batchLoading ? 'Processing...' : `Process Selected (${selectedIds.size})`}
                            </button>
                        )}
                    </div>

                    {/* Filters */}
                    <div className="flex space-x-2 flex-wrap gap-y-2">
                        <input
                            type="text"
                            placeholder="Search description..."
                            value={searchDescription}
                            onChange={(e) => setSearchDescription(e.target.value)}
                            className="block w-40 pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                        />
                        {/* ... Date filters ... */}
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
                                <th className="px-6 py-3 text-center">
                                    <input
                                        type="checkbox"
                                        onChange={toggleSelectAll}
                                        checked={selectedIds.size > 0 && selectedIds.size === transactions.filter(t => t.status === 'PENDING').length}
                                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                    />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detected / Suggested</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {/* ... Table Body ... */}
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-4 text-center">Loading...</td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-4 text-center text-gray-500">No transactions found.</td></tr>
                            ) : (
                                transactions.map((txn) => (
                                    <tr key={txn.id} className={txn.status === 'PENDING' ? 'bg-yellow-50' : ''}>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {txn.status === 'PENDING' && (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(txn.id)}
                                                    onChange={() => toggleSelection(txn.id)}
                                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                                />
                                            )}
                                        </td>
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
                                                                    className="text-blue-600 hover:text-blue-900 text-xs border border-blue-600 rounded px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    disabled={!['ZELLE', 'OTHER'].includes((txn.type || '').toUpperCase())}
                                                                    title={!['ZELLE', 'OTHER'].includes((txn.type || '').toUpperCase()) ? "Only available for Zelle or Other types" : "Link to member"}
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
                {/* ... Pagination ... */}
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
                                    Link Transaction to Donor
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

                                    {/* Link Mode Toggles */}
                                    <div className="flex space-x-2 mb-4 border-b border-gray-200 pb-2">
                                        <button
                                            className={`px-3 py-1 text-sm font-medium rounded-t-md ${!manualMode ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}`}
                                            onClick={() => setManualMode(false)}
                                        >
                                            Link to Member
                                        </button>
                                        <button
                                            className={`px-3 py-1 text-sm font-medium rounded-t-md ${manualMode ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}`}
                                            onClick={() => setManualMode(true)}
                                        >
                                            Manual Entry (Anonymous/Guest)
                                        </button>
                                    </div>

                                    {!manualMode ? (
                                        <>
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
                                                {(searchResults || []).map(member => (
                                                    <div
                                                        key={member.id}
                                                        onClick={() => handleManualReconcile(member)}
                                                        className="cursor-pointer hover:bg-gray-100 p-2 rounded flex justify-between items-center border-b last:border-0"
                                                    >
                                                        <div>
                                                            <span className="font-medium">{member.firstName} {member.lastName}</span>
                                                            <span className="text-xs text-gray-500 ml-2">{member.phoneNumber}</span>
                                                        </div>
                                                        <span className="text-blue-600 text-sm font-medium">Select</span>
                                                    </div>
                                                ))}
                                                {!searching && searchTerm.length >= 3 && searchResults.length === 0 && (
                                                    <p className="text-sm text-gray-500 text-center py-2">No members found.</p>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="space-y-3">
                                            <p className="text-xs text-gray-500">
                                                Enter the donor's name manually. This will be recorded in the transaction notes and ledger memo (e.g., "[Manual Donor]: Name").
                                            </p>
                                            <div className="flex space-x-4 mb-2">
                                                <label className="inline-flex items-center">
                                                    <input
                                                        type="radio"
                                                        value="Individual"
                                                        checked={manualDonorType === 'Individual'}
                                                        onChange={() => setManualDonorType('Individual')}
                                                        className="form-radio text-blue-600"
                                                    />
                                                    <span className="ml-2">Individual</span>
                                                </label>
                                                <label className="inline-flex items-center">
                                                    <input
                                                        type="radio"
                                                        value="Organization"
                                                        checked={manualDonorType === 'Organization'}
                                                        onChange={() => setManualDonorType('Organization')}
                                                        className="form-radio text-blue-600"
                                                    />
                                                    <span className="ml-2">Organization</span>
                                                </label>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder={manualDonorType === 'Individual' ? "Enter Donor Name (e.g. John Doe - Guest)" : "Enter Organization Name (e.g. Local Business)"}
                                                className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                                                value={manualDonorName}
                                                onChange={(e) => setManualDonorName(e.target.value)}
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={handleLinkSubmit}
                                                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:text-sm"
                                            >
                                                Save Manual Entry
                                            </button>
                                        </div>
                                    )}

                                    {/* Potential Matches Section - Only show in Member Mode or always? Always useful to see checks. */}
                                    {!manualMode && txnToLink.potential_matches && txnToLink.potential_matches.length > 0 && (
                                        <div className="mt-6 border-t pt-4">
                                            <h4 className="text-sm font-medium text-orange-700 mb-2">Potential System Matches (Prevent Duplicates)</h4>
                                            <div className="bg-orange-50 rounded-md p-2">
                                                {(txnToLink.potential_matches || []).map(pm => (
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

            {/* Confirm Match Modal (Existing) ... */}
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
