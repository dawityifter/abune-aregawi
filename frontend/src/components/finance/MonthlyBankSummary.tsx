import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface MonthSummary {
    month: string;           // "2026-07"
    label: string;           // "Jul 2026"
    income: number;
    expense: number;
    net: number;
    ending_balance: number | null;
    pending_count: number;
    transaction_count: number;
}

/**
 * Month-by-month income/expense summary built from uploaded bank
 * transactions. Shown above the Bank Transactions table.
 */
const MonthlyBankSummary: React.FC = () => {
    const { firebaseUser } = useAuth();
    const { t } = useLanguage();
    const [months, setMonths] = useState<MonthSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    const fetchSummary = useCallback(async () => {
        if (!firebaseUser) return;
        try {
            setLoading(true);
            const token = await firebaseUser.getIdToken();
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
            const res = await fetch(`${apiUrl}/api/bank/summary/monthly`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setMonths(data.data.months || []);
            }
        } catch (err) {
            console.error('Monthly summary error:', err);
        } finally {
            setLoading(false);
        }
    }, [firebaseUser]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    // Refresh together with the transactions table (upload, reconcile, undo)
    useEffect(() => {
        const handleRefresh = () => fetchSummary();
        window.addEventListener('bank:refresh', handleRefresh);
        window.addEventListener('payments:refresh', handleRefresh);
        return () => {
            window.removeEventListener('bank:refresh', handleRefresh);
            window.removeEventListener('payments:refresh', handleRefresh);
        };
    }, [fetchSummary]);

    const money = (n: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    // Accounting convention: deficits in parentheses
    const netDisplay = (n: number) => (n < 0 ? `(${money(Math.abs(n))})` : money(n));

    const activeMonths = months.filter(m => m.transaction_count > 0);
    const visibleMonths = expanded ? activeMonths : activeMonths.slice(0, 6);

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 p-4">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">{t('monthlyBankSummary.title')}</h3>
                    <p className="text-sm text-gray-600">{t('monthlyBankSummary.subtitle', { count: expanded ? 12 : 6 })}</p>
                </div>
                {activeMonths.length > 6 && (
                    <button
                        onClick={() => setExpanded(e => !e)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                        {expanded ? t('monthlyBankSummary.showLast6') : t('monthlyBankSummary.showLast12')}
                    </button>
                )}
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-100/80">
                        <tr>
                            <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('monthlyBankSummary.colMonth')}</th>
                            <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('monthlyBankSummary.colIncome')}</th>
                            <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('monthlyBankSummary.colExpense')}</th>
                            <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('monthlyBankSummary.colNet')}</th>
                            <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('monthlyBankSummary.colBalance')}</th>
                            <th className="px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('monthlyBankSummary.colStatus')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-6 text-center text-slate-500">{t('monthlyBankSummary.loading')}</td></tr>
                        ) : visibleMonths.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-6 text-center text-slate-500">{t('monthlyBankSummary.empty')}</td></tr>
                        ) : (
                            visibleMonths.map((m, index) => (
                                <tr key={m.month} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                    <td className="whitespace-nowrap px-6 py-3 text-sm font-medium text-slate-900">{m.label}</td>
                                    <td className="whitespace-nowrap px-6 py-3 text-right text-sm font-semibold text-emerald-700">{money(m.income)}</td>
                                    <td className="whitespace-nowrap px-6 py-3 text-right text-sm font-semibold text-red-700">{money(m.expense)}</td>
                                    <td className={`whitespace-nowrap px-6 py-3 text-right text-sm font-semibold ${m.net < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                        {netDisplay(m.net)}
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-3 text-right text-sm font-medium text-slate-900">
                                        {m.ending_balance !== null ? money(m.ending_balance) : '—'}
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-3 text-center">
                                        {m.pending_count === 0 ? (
                                            <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                                                {t('monthlyBankSummary.reconciled')}
                                            </span>
                                        ) : (
                                            <span
                                                className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"
                                                title={t('monthlyBankSummary.awaitingReview', { pending: m.pending_count, total: m.transaction_count })}
                                            >
                                                {t('monthlyBankSummary.pending', { count: m.pending_count })}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MonthlyBankSummary;
