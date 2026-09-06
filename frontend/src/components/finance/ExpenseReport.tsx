import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * Category-level expense report.
 *
 * Complements the Monthly Summary rather than repeating it: that screen answers
 * "how much did we spend each month" from bank activity, this one answers "on
 * what". Every figure below — the cards, the trend, the matrix, the category
 * breakdown — comes from a single GET /api/expenses/report response, so no
 * total is ever recomputed here in a way that could disagree with another
 * section. The component does no money arithmetic at all.
 */

const UNCATEGORIZED = 'UNCATEGORIZED';

interface MonthRow {
    month: string;        // '2026-08'
    short_label: string;  // 'Aug'
    label: string;        // 'Aug 2026'
    long_label: string;   // 'August 2026'
    total: number;
    count: number;
}

interface CategoryRow {
    gl_code: string;
    name: string;
    total: number;
    count: number;
    percent: number;
    is_uncategorized: boolean;
}

interface MatrixRow {
    gl_code: string;
    name: string;
    cells: number[];
    total: number;
    is_uncategorized: boolean;
}

interface ExpenseReportData {
    range: { start: string; end: string; year: number };
    months: MonthRow[];
    categories: CategoryRow[];
    matrix: {
        months: Array<{ month: string; short_label: string; label: string }>;
        rows: MatrixRow[];
        month_totals: number[];
        grand_total: number;
    };
    summary: {
        total: number;
        categorized_total: number;
        uncategorized_total: number;
        uncategorized_count: number;
        uncategorized_percent: number;
        dismissed_total: number;
        dismissed_count: number;
        current_month: number;
        current_month_label: string | null;
        average_monthly: number;
        months_elapsed: number;
        expense_count: number;
        largest_category: { gl_code: string; name: string; total: number; percent: number } | null;
    };
    reconciliation: {
        applies: boolean;
        bank_debits: number;
        report_total: number;
        difference: number;
        unlinked_ledger_total: number;
        unlinked_ledger_count: number;
        returned_item_total: number;
        timing_difference: number;
        needs_review_count: number;
    };
}

interface DrillRow {
    key: string;
    source: 'ledger' | 'bank';
    source_label: string;
    status: 'MATCHED' | 'RECORDED' | 'IMPORTED' | 'DISMISSED';
    date: string;
    gl_code: string;
    category_name: string;
    payee: string | null;
    amount: number;
    payment_method: string | null;
    check_number: string | null;
    memo: string | null;
}

interface ExpenseCategoryOption {
    id: string;
    gl_code: string;
    name: string;
}

interface Filters {
    year: number;
    startDate: string;
    endDate: string;
    glCode: string;
    payee: string;
    paymentMethod: string;
    source: string;
    status: string;
}

interface ExpenseReportProps {
    availableYears?: number[];
}

const PAYMENT_METHODS = ['cash', 'check', 'ach', 'debit_card', 'credit_card', 'other'];
const SOURCES = ['all', 'ledger', 'bank'];
const STATUSES = ['all', 'matched', 'recorded', 'imported', 'dismissed'];

const money = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

/** Blank rather than $0.00 in a matrix cell — a grid of zeros hides the data. */
const cellMoney = (n: number) => (n === 0 ? '—' : money(n));

const ExpenseReport: React.FC<ExpenseReportProps> = ({ availableYears }) => {
    const { firebaseUser } = useAuth();
    const { t } = useLanguage();

    const currentYear = new Date().getFullYear();
    const years = useMemo(
        () => (availableYears && availableYears.length > 0
            ? availableYears
            : Array.from({ length: 5 }, (_, i) => currentYear - i)),
        [availableYears, currentYear]
    );

    const [filters, setFilters] = useState<Filters>({
        year: currentYear,
        startDate: '',
        endDate: '',
        glCode: '',
        payee: '',
        paymentMethod: '',
        source: 'all',
        status: 'all'
    });

    const [report, setReport] = useState<ExpenseReportData | null>(null);
    const [categories, setCategories] = useState<ExpenseCategoryOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Drill-down: which cell the treasurer clicked, and its transactions.
    const [drill, setDrill] = useState<{ glCode: string; label: string; month: string | null } | null>(null);
    const [drillRows, setDrillRows] = useState<DrillRow[]>([]);
    const [drillTotal, setDrillTotal] = useState(0);
    const [drillLoading, setDrillLoading] = useState(false);
    const [drillError, setDrillError] = useState<string | null>(null);

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

    /** The filter set as query params, shared by the report and its drill-down. */
    const queryParams = useCallback(() => {
        const params = new URLSearchParams();
        params.append('year', String(filters.year));
        if (filters.startDate) params.append('start_date', filters.startDate);
        if (filters.endDate) params.append('end_date', filters.endDate);
        if (filters.glCode) params.append('gl_code', filters.glCode);
        if (filters.payee) params.append('payee', filters.payee);
        if (filters.paymentMethod) params.append('payment_method', filters.paymentMethod);
        if (filters.source !== 'all') params.append('source', filters.source);
        if (filters.status !== 'all') params.append('status', filters.status);
        return params;
    }, [filters]);

    const fetchReport = useCallback(async () => {
        if (!firebaseUser) return;
        try {
            setLoading(true);
            setError(null);
            const token = await firebaseUser.getIdToken();
            const res = await fetch(`${apiUrl}/api/expenses/report?${queryParams().toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || t('expenseReport.error'));
            }
            setReport(data.data);
        } catch (err: any) {
            console.error('Expense report error:', err);
            setError(err.message || t('expenseReport.error'));
            setReport(null);
        } finally {
            setLoading(false);
        }
    }, [firebaseUser, apiUrl, queryParams, t]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    // Keep in step with the rest of the treasurer screens: an upload, a
    // reconciliation or a new expense all change these totals.
    useEffect(() => {
        const handleRefresh = () => fetchReport();
        window.addEventListener('bank:refresh', handleRefresh);
        window.addEventListener('payments:refresh', handleRefresh);
        return () => {
            window.removeEventListener('bank:refresh', handleRefresh);
            window.removeEventListener('payments:refresh', handleRefresh);
        };
    }, [fetchReport]);

    useEffect(() => {
        const fetchCategories = async () => {
            if (!firebaseUser) return;
            try {
                const token = await firebaseUser.getIdToken();
                const res = await fetch(`${apiUrl}/api/expenses/categories`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) setCategories(data.data || []);
            } catch (err) {
                console.error('Expense categories error:', err);
            }
        };
        fetchCategories();
    }, [firebaseUser, apiUrl]);

    const openDrill = useCallback(async (glCode: string, label: string, month: string | null) => {
        setDrill({ glCode, label, month });
        setDrillRows([]);
        setDrillError(null);
        setDrillLoading(true);
        try {
            const token = await firebaseUser?.getIdToken();
            const params = queryParams();
            // The clicked cell wins over the filter bar's category, so clicking
            // Building/August cannot come back showing every category.
            params.delete('gl_code');
            if (glCode) params.append('gl_code', glCode);
            if (month) params.append('month', month);
            params.append('limit', '200');

            const res = await fetch(`${apiUrl}/api/expenses/report/transactions?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || t('expenseReport.error'));
            }
            setDrillRows(data.data || []);
            setDrillTotal(data.total || 0);
        } catch (err: any) {
            console.error('Expense drill-down error:', err);
            setDrillError(err.message || t('expenseReport.error'));
        } finally {
            setDrillLoading(false);
        }
    }, [firebaseUser, apiUrl, queryParams, t]);

    const setFilter = (patch: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...patch }));

    const clearFilters = () => setFilters({
        year: filters.year,
        startDate: '',
        endDate: '',
        glCode: '',
        payee: '',
        paymentMethod: '',
        source: 'all',
        status: 'all'
    });

    const hasFilters = Boolean(
        filters.startDate || filters.endDate || filters.glCode || filters.payee
        || filters.paymentMethod || filters.source !== 'all' || filters.status !== 'all'
    );

    /**
     * CSV of every section, built from the payload already on screen — the file
     * and the page are guaranteed to hold the same numbers.
     */
    const exportCsv = () => {
        if (!report) return;

        const esc = (value: string | number | null) => {
            const text = value === null || value === undefined ? '' : String(value);
            return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        };
        const lines: string[] = [];
        const section = (title: string) => {
            if (lines.length > 0) lines.push('');
            lines.push(esc(title));
        };

        lines.push(esc(t('expenseReport.title')));
        lines.push(`${esc(t('expenseReport.csv.range'))},${esc(report.range.start)},${esc(report.range.end)}`);

        section(t('expenseReport.monthly.title'));
        lines.push([t('expenseReport.col.month'), t('expenseReport.col.expenses'), t('expenseReport.col.count')].map(esc).join(','));
        report.months.forEach((m) => lines.push([m.long_label, m.total.toFixed(2), m.count].map(esc).join(',')));
        lines.push([t('expenseReport.col.total'), report.summary.total.toFixed(2), report.summary.expense_count].map(esc).join(','));

        section(t('expenseReport.matrix.title'));
        lines.push([t('expenseReport.col.category'), ...report.matrix.months.map((m) => m.label), t('expenseReport.col.ytd')].map(esc).join(','));
        report.matrix.rows.forEach((row) => {
            lines.push([row.name, ...row.cells.map((c) => c.toFixed(2)), row.total.toFixed(2)].map(esc).join(','));
        });
        lines.push([
            t('expenseReport.col.total'),
            ...report.matrix.month_totals.map((c) => c.toFixed(2)),
            report.matrix.grand_total.toFixed(2)
        ].map(esc).join(','));

        section(t('expenseReport.categories.title'));
        lines.push([t('expenseReport.col.category'), t('expenseReport.col.glCode'), t('expenseReport.col.ytdExpenses'), t('expenseReport.col.percentOfTotal'), t('expenseReport.col.count')].map(esc).join(','));
        report.categories.forEach((c) => {
            lines.push([c.name, c.gl_code, c.total.toFixed(2), `${c.percent}%`, c.count].map(esc).join(','));
        });
        lines.push([t('expenseReport.col.total'), '', report.summary.total.toFixed(2), '100%', report.summary.expense_count].map(esc).join(','));

        section(t('expenseReport.reconciliation.title'));
        const r = report.reconciliation;
        ([
            [t('expenseReport.reconciliation.reportTotal'), r.report_total],
            [t('expenseReport.reconciliation.bankDebits'), r.bank_debits],
            [t('expenseReport.reconciliation.difference'), r.difference],
            [t('expenseReport.reconciliation.unlinked'), r.unlinked_ledger_total],
            [t('expenseReport.reconciliation.returned'), r.returned_item_total],
            [t('expenseReport.reconciliation.timing'), r.timing_difference]
        ] as Array<[string, number]>).forEach(([label, value]) => {
            lines.push([label, value.toFixed(2)].map(esc).join(','));
        });

        const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `expense-report-${report.range.start}-to-${report.range.end}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Bar widths are presentation only — never a money calculation.
    const maxMonth = report ? Math.max(...report.months.map((m) => m.total), 0) : 0;
    const barWidth = (value: number, max: number) => (max > 0 ? Math.round((value / max) * 100) : 0);

    const statusBadge = (status: DrillRow['status']) => {
        const styles: Record<DrillRow['status'], string> = {
            MATCHED: 'bg-emerald-100 text-emerald-800',
            RECORDED: 'bg-blue-100 text-blue-800',
            IMPORTED: 'bg-amber-100 text-amber-800',
            DISMISSED: 'bg-slate-200 text-slate-700'
        };
        return (
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
                {t(`expenseReport.status.${status.toLowerCase()}`)}
            </span>
        );
    };

    const cardClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
    const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500';
    const thClass = 'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500';
    const thNumClass = 'px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div>
                    <h2 className="text-2xl font-semibold text-gray-900">{t('expenseReport.title')}</h2>
                    <p className="text-sm text-gray-600">{t('expenseReport.subtitle')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="expense-report-year" className="text-sm text-gray-500">
                        {t('expenseReport.filters.year')}:
                    </label>
                    <select
                        id="expense-report-year"
                        value={filters.year}
                        onChange={(e) => setFilter({ year: Number(e.target.value) })}
                        className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {years.map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <button
                        onClick={exportCsv}
                        disabled={!report}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        <i className="fas fa-file-csv mr-2" aria-hidden="true"></i>
                        {t('expenseReport.actions.exportCsv')}
                    </button>
                    <button
                        onClick={() => window.print()}
                        disabled={!report}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        <i className="fas fa-print mr-2" aria-hidden="true"></i>
                        {t('expenseReport.actions.print')}
                    </button>
                </div>
            </div>

            {/* Print-only header, matching the other treasurer reports */}
            <div className="mb-6 hidden text-center print:block">
                <h1 className="text-2xl font-bold">{t('expenseReport.title')}</h1>
                {report && (
                    <p className="text-sm text-gray-700">{report.range.start} — {report.range.end}</p>
                )}
            </div>

            {/* Filters */}
            <div className="rounded-lg bg-white p-6 shadow-md print:hidden">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">{t('expenseReport.filters.title')}</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    <div>
                        <label htmlFor="er-start" className="mb-1 block text-sm font-medium text-gray-700">
                            {t('expenseReport.filters.startDate')}
                        </label>
                        <input
                            id="er-start"
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilter({ startDate: e.target.value })}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="er-end" className="mb-1 block text-sm font-medium text-gray-700">
                            {t('expenseReport.filters.endDate')}
                        </label>
                        <input
                            id="er-end"
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilter({ endDate: e.target.value })}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="er-category" className="mb-1 block text-sm font-medium text-gray-700">
                            {t('expenseReport.filters.category')}
                        </label>
                        <select
                            id="er-category"
                            value={filters.glCode}
                            onChange={(e) => setFilter({ glCode: e.target.value })}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">{t('expenseReport.filters.allCategories')}</option>
                            <option value={UNCATEGORIZED}>{t('expenseReport.uncategorized')}</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.gl_code}>{cat.gl_code} - {cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="er-method" className="mb-1 block text-sm font-medium text-gray-700">
                            {t('expenseReport.filters.paymentMethod')}
                        </label>
                        <select
                            id="er-method"
                            value={filters.paymentMethod}
                            onChange={(e) => setFilter({ paymentMethod: e.target.value })}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">{t('expenseReport.filters.allMethods')}</option>
                            {PAYMENT_METHODS.map((method) => (
                                <option key={method} value={method}>{t(`expenseReport.method.${method}`)}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="er-source" className="mb-1 block text-sm font-medium text-gray-700">
                            {t('expenseReport.filters.source')}
                        </label>
                        <select
                            id="er-source"
                            value={filters.source}
                            onChange={(e) => setFilter({ source: e.target.value })}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {SOURCES.map((source) => (
                                <option key={source} value={source}>{t(`expenseReport.source.${source}`)}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="er-status" className="mb-1 block text-sm font-medium text-gray-700">
                            {t('expenseReport.filters.status')}
                        </label>
                        <select
                            id="er-status"
                            value={filters.status}
                            onChange={(e) => setFilter({ status: e.target.value })}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {STATUSES.map((status) => (
                                <option key={status} value={status}>{t(`expenseReport.statusFilter.${status}`)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="xl:col-span-2">
                        <label htmlFor="er-payee" className="mb-1 block text-sm font-medium text-gray-700">
                            {t('expenseReport.filters.payee')}
                        </label>
                        <input
                            id="er-payee"
                            type="text"
                            placeholder={t('expenseReport.filters.payeePlaceholder')}
                            value={filters.payee}
                            onChange={(e) => setFilter({ payee: e.target.value })}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
                {hasFilters && (
                    <div className="mt-4">
                        <button onClick={clearFilters} className="text-sm text-blue-600 underline hover:text-blue-700">
                            {t('expenseReport.filters.clear')}
                        </button>
                    </div>
                )}
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    <i className="fas fa-exclamation-circle mr-2" aria-hidden="true"></i>
                    {error}
                    <button onClick={fetchReport} className="ml-3 underline print:hidden">
                        {t('expenseReport.retry')}
                    </button>
                </div>
            )}

            {loading && (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
                    {t('expenseReport.loading')}
                </div>
            )}

            {!loading && report && (
                <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                        <div className={cardClass}>
                            <p className={labelClass}>{t('expenseReport.cards.ytd')}</p>
                            <p className="mt-2 text-2xl font-bold text-slate-900">{money(report.summary.total)}</p>
                            <p className="mt-1 text-xs text-slate-500">
                                {t('expenseReport.cards.ytdNote', { start: report.range.start, end: report.range.end })}
                            </p>
                        </div>
                        <div className={cardClass}>
                            <p className={labelClass}>{t('expenseReport.cards.currentMonth')}</p>
                            <p className="mt-2 text-2xl font-bold text-slate-900">{money(report.summary.current_month)}</p>
                            <p className="mt-1 text-xs text-slate-500">
                                {report.summary.current_month_label || t('expenseReport.cards.outsideRange')}
                            </p>
                        </div>
                        <div className={cardClass}>
                            <p className={labelClass}>{t('expenseReport.cards.averageMonthly')}</p>
                            <p className="mt-2 text-2xl font-bold text-slate-900">{money(report.summary.average_monthly)}</p>
                            <p className="mt-1 text-xs text-slate-500">
                                {t('expenseReport.cards.averageNote', { count: report.summary.months_elapsed })}
                            </p>
                        </div>
                        <div className={cardClass}>
                            <p className={labelClass}>{t('expenseReport.cards.largestCategory')}</p>
                            <p className="mt-2 truncate text-lg font-bold text-slate-900" title={report.summary.largest_category?.name}>
                                {report.summary.largest_category?.name || '—'}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {report.summary.largest_category
                                    ? `${money(report.summary.largest_category.total)} · ${report.summary.largest_category.percent}%`
                                    : '—'}
                            </p>
                        </div>
                        <div className={cardClass}>
                            <p className={labelClass}>{t('expenseReport.cards.count')}</p>
                            <p className="mt-2 text-2xl font-bold text-slate-900">{report.summary.expense_count}</p>
                            <p className="mt-1 text-xs text-slate-500">{t('expenseReport.cards.countNote')}</p>
                        </div>
                    </div>

                    {/* Needs categorization */}
                    {report.summary.uncategorized_total > 0 && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-base font-semibold text-amber-900">
                                        <i className="fas fa-exclamation-triangle mr-2" aria-hidden="true"></i>
                                        {t('expenseReport.uncategorizedBanner.title')}
                                    </h3>
                                    <p className="mt-1 text-sm text-amber-800">
                                        {t('expenseReport.uncategorizedBanner.body', {
                                            amount: money(report.summary.uncategorized_total),
                                            count: report.summary.uncategorized_count,
                                            percent: report.summary.uncategorized_percent
                                        })}
                                    </p>
                                    {report.summary.dismissed_count > 0 && (
                                        <p className="mt-1 text-xs text-amber-700">
                                            {t('expenseReport.uncategorizedBanner.dismissed', {
                                                amount: money(report.summary.dismissed_total),
                                                count: report.summary.dismissed_count
                                            })}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => openDrill(UNCATEGORIZED, t('expenseReport.uncategorized'), null)}
                                    className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 print:hidden"
                                >
                                    {t('expenseReport.uncategorizedBanner.review')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Monthly trend */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 bg-slate-50/80 p-4">
                            <h3 className="text-lg font-medium text-gray-900">{t('expenseReport.monthly.title')}</h3>
                            <p className="text-sm text-gray-600">{t('expenseReport.monthly.subtitle')}</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-100/80">
                                    <tr>
                                        <th className={thClass}>{t('expenseReport.col.month')}</th>
                                        <th className={thNumClass}>{t('expenseReport.col.expenses')}</th>
                                        <th className={thNumClass}>{t('expenseReport.col.count')}</th>
                                        <th className={`${thClass} w-1/2 print:hidden`}>{t('expenseReport.col.share')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {report.months.map((m, index) => (
                                        <tr key={m.month} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">{m.long_label}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-slate-900">
                                                {m.total > 0 ? (
                                                    <button
                                                        onClick={() => openDrill('', m.long_label, m.month)}
                                                        className="text-red-700 underline-offset-2 hover:underline print:no-underline"
                                                    >
                                                        {money(m.total)}
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-400">{money(0)}</span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-600">{m.count}</td>
                                            <td className="px-4 py-3 print:hidden">
                                                <div className="h-2 w-full rounded-full bg-slate-100">
                                                    <div
                                                        className="h-2 rounded-full bg-red-500"
                                                        style={{ width: `${barWidth(m.total, maxMonth)}%` }}
                                                        role="presentation"
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t-2 border-slate-300 bg-slate-100/80">
                                    <tr>
                                        <td className="px-4 py-3 text-sm font-bold text-slate-900">{t('expenseReport.col.ytdTotal')}</td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">{money(report.summary.total)}</td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">{report.summary.expense_count}</td>
                                        <td className="print:hidden"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Month x category matrix */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 bg-slate-50/80 p-4">
                            <h3 className="text-lg font-medium text-gray-900">{t('expenseReport.matrix.title')}</h3>
                            <p className="text-sm text-gray-600">{t('expenseReport.matrix.subtitle')}</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-100/80">
                                    <tr>
                                        <th className={`${thClass} sticky left-0 z-10 bg-slate-100`}>{t('expenseReport.col.category')}</th>
                                        {report.matrix.months.map((m) => (
                                            <th key={m.month} className={thNumClass} title={m.label}>{m.short_label}</th>
                                        ))}
                                        <th className={`${thNumClass} bg-slate-200/70`}>{t('expenseReport.col.ytd')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {report.matrix.rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={report.matrix.months.length + 2} className="px-4 py-6 text-center text-slate-500">
                                                {t('expenseReport.empty')}
                                            </td>
                                        </tr>
                                    ) : report.matrix.rows.map((row, index) => (
                                        <tr key={row.gl_code} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                            <td
                                                className={`sticky left-0 z-10 max-w-[16rem] truncate px-4 py-3 text-sm font-medium ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} ${row.is_uncategorized ? 'text-amber-800' : 'text-slate-900'}`}
                                                title={row.name}
                                            >
                                                {row.name}
                                            </td>
                                            {row.cells.map((value, i) => (
                                                <td key={report.matrix.months[i].month} className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-700">
                                                    {value > 0 ? (
                                                        <button
                                                            onClick={() => openDrill(
                                                                row.gl_code,
                                                                `${row.name} · ${report.matrix.months[i].label}`,
                                                                report.matrix.months[i].month
                                                            )}
                                                            className="underline-offset-2 hover:underline print:no-underline"
                                                        >
                                                            {cellMoney(value)}
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-300">{cellMoney(value)}</span>
                                                    )}
                                                </td>
                                            ))}
                                            <td className="whitespace-nowrap bg-slate-50 px-4 py-3 text-right text-sm font-semibold text-slate-900">
                                                <button
                                                    onClick={() => openDrill(row.gl_code, row.name, null)}
                                                    className="underline-offset-2 hover:underline print:no-underline"
                                                >
                                                    {money(row.total)}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t-2 border-slate-300 bg-slate-100/80">
                                    <tr>
                                        <td className={`${thClass} sticky left-0 z-10 bg-slate-100 text-sm font-bold text-slate-900`}>
                                            {t('expenseReport.col.total')}
                                        </td>
                                        {report.matrix.month_totals.map((total, i) => (
                                            <td key={report.matrix.months[i].month} className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold text-slate-900">
                                                {cellMoney(total)}
                                            </td>
                                        ))}
                                        <td className="whitespace-nowrap bg-slate-200/70 px-4 py-3 text-right text-sm font-bold text-slate-900">
                                            {money(report.matrix.grand_total)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* YTD by category */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 bg-slate-50/80 p-4">
                            <h3 className="text-lg font-medium text-gray-900">{t('expenseReport.categories.title')}</h3>
                            <p className="text-sm text-gray-600">{t('expenseReport.categories.subtitle')}</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-100/80">
                                    <tr>
                                        <th className={thClass}>{t('expenseReport.col.category')}</th>
                                        <th className={thNumClass}>{t('expenseReport.col.ytdExpenses')}</th>
                                        <th className={thNumClass}>{t('expenseReport.col.percentOfTotal')}</th>
                                        <th className={thNumClass}>{t('expenseReport.col.count')}</th>
                                        <th className={`${thClass} w-1/3 print:hidden`}>{t('expenseReport.col.share')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {report.categories.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-6 text-center text-slate-500">{t('expenseReport.empty')}</td>
                                        </tr>
                                    ) : report.categories.map((c, index) => (
                                        <tr key={c.gl_code} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                            <td className={`px-4 py-3 text-sm font-medium ${c.is_uncategorized ? 'text-amber-800' : 'text-slate-900'}`}>
                                                <button
                                                    onClick={() => openDrill(c.gl_code, c.name, null)}
                                                    className="text-left underline-offset-2 hover:underline print:no-underline"
                                                >
                                                    {c.name}
                                                </button>
                                                {!c.is_uncategorized && (
                                                    <span className="ml-2 text-xs text-slate-400">{c.gl_code}</span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-slate-900">{money(c.total)}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-700">{c.percent}%</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-600">{c.count}</td>
                                            <td className="px-4 py-3 print:hidden">
                                                <div className="h-2 w-full rounded-full bg-slate-100">
                                                    <div
                                                        className={`h-2 rounded-full ${c.is_uncategorized ? 'bg-amber-500' : 'bg-red-500'}`}
                                                        style={{ width: `${Math.round(c.percent)}%` }}
                                                        role="presentation"
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t-2 border-slate-300 bg-slate-100/80">
                                    <tr>
                                        <td className="px-4 py-3 text-sm font-bold text-slate-900">{t('expenseReport.col.total')}</td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">{money(report.summary.total)}</td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">100%</td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">{report.summary.expense_count}</td>
                                        <td className="print:hidden"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* How this ties to the Monthly Summary. Hidden under a
                        category/payee/method filter: the bank-debit side is the
                        whole statement and cannot be narrowed to match, so the
                        comparison would be meaningless. */}
                    {report.reconciliation.applies ? (
                    <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                            {t('expenseReport.reconciliation.title')}
                        </summary>
                        <p className="mt-3 text-sm text-slate-600">{t('expenseReport.reconciliation.explainer')}</p>
                        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                            {([
                                ['reportTotal', report.reconciliation.report_total],
                                ['bankDebits', report.reconciliation.bank_debits],
                                ['difference', report.reconciliation.difference],
                                ['unlinked', report.reconciliation.unlinked_ledger_total],
                                ['returned', report.reconciliation.returned_item_total],
                                ['timing', report.reconciliation.timing_difference]
                            ] as Array<[string, number]>).map(([key, value]) => (
                                <div key={key} className="flex items-baseline justify-between border-b border-slate-100 py-1">
                                    <dt className="text-sm text-slate-600">{t(`expenseReport.reconciliation.${key}`)}</dt>
                                    <dd className="text-sm font-semibold text-slate-900">{money(value)}</dd>
                                </div>
                            ))}
                        </dl>
                    </details>
                    ) : (
                        <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                            {t('expenseReport.reconciliation.filtered')}
                        </p>
                    )}
                </>
            )}

            {/* Drill-down */}
            {drill && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('expenseReport.drill.title')}
                    onClick={() => setDrill(null)}
                >
                    <div
                        className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 p-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">{t('expenseReport.drill.title')}</h3>
                                <p className="text-sm text-gray-600">{drill.label}</p>
                            </div>
                            <button
                                onClick={() => setDrill(null)}
                                className="rounded p-2 text-slate-500 hover:bg-slate-200"
                                aria-label={t('expenseReport.drill.close')}
                            >
                                <i className="fas fa-times" aria-hidden="true"></i>
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto">
                            {drillLoading ? (
                                <p className="p-8 text-center text-slate-500">{t('expenseReport.loading')}</p>
                            ) : drillError ? (
                                <p className="p-8 text-center text-red-700">{drillError}</p>
                            ) : drillRows.length === 0 ? (
                                <p className="p-8 text-center text-slate-500">{t('expenseReport.drill.empty')}</p>
                            ) : (
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="sticky top-0 bg-slate-100">
                                        <tr>
                                            <th className={thClass}>{t('expenseReport.col.date')}</th>
                                            <th className={thClass}>{t('expenseReport.col.payee')}</th>
                                            <th className={thNumClass}>{t('expenseReport.col.amount')}</th>
                                            <th className={thClass}>{t('expenseReport.col.method')}</th>
                                            <th className={thClass}>{t('expenseReport.col.source')}</th>
                                            <th className={thClass}>{t('expenseReport.col.status')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {drillRows.map((row, index) => (
                                            <tr key={row.key} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">{row.date}</td>
                                                <td className="px-4 py-3 text-sm text-slate-900">
                                                    <div className="font-medium">{row.payee || t('expenseReport.drill.noPayee')}</div>
                                                    {row.memo && (
                                                        <div className="max-w-md truncate text-xs text-slate-500" title={row.memo}>{row.memo}</div>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-slate-900">{money(row.amount)}</td>
                                                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                                                    {row.payment_method ? t(`expenseReport.method.${row.payment_method}`) : '—'}
                                                    {row.check_number && <span className="ml-1 text-xs text-slate-400">#{row.check_number}</span>}
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{row.source_label}</td>
                                                <td className="whitespace-nowrap px-4 py-3">{statusBadge(row.status)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-4">
                            <span className="text-sm text-slate-600">
                                {t('expenseReport.drill.count', { count: drillRows.length })}
                            </span>
                            <span className="text-base font-bold text-slate-900">{money(drillTotal)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpenseReport;
