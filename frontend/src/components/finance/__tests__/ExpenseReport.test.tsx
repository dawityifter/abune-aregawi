import React from 'react';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExpenseReport from '../ExpenseReport';

jest.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

jest.mock('../../../contexts/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}));

global.fetch = jest.fn();

/**
 * A three-month report whose numbers tie: monthly totals, category totals and
 * the matrix all add to 9,440.75, and 7,650.50 categorized + 1,790.25
 * uncategorized reaches the same figure. The component must render the server's
 * numbers verbatim — it does no money arithmetic of its own.
 */
const REPORT = {
    range: { start: '2026-07-01', end: '2026-09-30', year: 2026 },
    months: [
        { month: '2026-07', short_label: 'Jul', label: 'Jul 2026', long_label: 'July 2026', total: 5000.00, count: 1 },
        { month: '2026-08', short_label: 'Aug', label: 'Aug 2026', long_label: 'August 2026', total: 4400.75, count: 3 },
        { month: '2026-09', short_label: 'Sep', label: 'Sep 2026', long_label: 'September 2026', total: 40.00, count: 1 },
    ],
    categories: [
        { gl_code: 'EXP001', name: 'Salary/Allowance', total: 5000.00, count: 1, percent: 52.96, is_uncategorized: false },
        { gl_code: 'EXP102', name: 'Building Repairs', total: 2500.00, count: 1, percent: 26.48, is_uncategorized: false },
        { gl_code: 'UNCATEGORIZED', name: 'Uncategorized / Needs Review', total: 1790.25, count: 2, percent: 18.96, is_uncategorized: true },
        { gl_code: 'EXP005', name: 'Utility', total: 150.50, count: 3, percent: 1.59, is_uncategorized: false },
    ],
    matrix: {
        months: [
            { month: '2026-07', short_label: 'Jul', label: 'Jul 2026' },
            { month: '2026-08', short_label: 'Aug', label: 'Aug 2026' },
            { month: '2026-09', short_label: 'Sep', label: 'Sep 2026' },
        ],
        rows: [
            { gl_code: 'EXP001', name: 'Salary/Allowance', cells: [5000.00, 0, 0], total: 5000.00, is_uncategorized: false },
            { gl_code: 'EXP102', name: 'Building Repairs', cells: [0, 2500.00, 0], total: 2500.00, is_uncategorized: false },
            { gl_code: 'UNCATEGORIZED', name: 'Uncategorized / Needs Review', cells: [0, 1750.25, 40.00], total: 1790.25, is_uncategorized: true },
            { gl_code: 'EXP005', name: 'Utility', cells: [0, 150.50, 0], total: 150.50, is_uncategorized: false },
        ],
        month_totals: [5000.00, 4400.75, 40.00],
        grand_total: 9440.75,
    },
    summary: {
        total: 9440.75,
        categorized_total: 7650.50,
        uncategorized_total: 1790.25,
        uncategorized_count: 2,
        uncategorized_percent: 18.96,
        dismissed_total: 40.00,
        dismissed_count: 1,
        current_month: 40.00,
        current_month_label: 'Sep 2026',
        average_monthly: 3146.92,
        months_elapsed: 3,
        expense_count: 7,
        largest_category: { gl_code: 'EXP001', name: 'Salary/Allowance', total: 5000.00, percent: 52.96 },
    },
    reconciliation: {
        bank_debits: 9590.25,
        report_total: 9440.75,
        difference: -149.50,
        unlinked_ledger_total: 150.50,
        unlinked_ledger_count: 3,
        returned_item_total: 300.00,
        timing_difference: 0,
        needs_review_count: 2,
    },
};

const DRILL_ROWS = [
    {
        key: 'ledger:1', source: 'ledger', source_label: 'Chase + Expense', status: 'MATCHED',
        date: '2026-08-10', gl_code: 'EXP102', category_name: 'Building Repairs',
        payee: 'ABC Construction', amount: 2500.00, payment_method: 'check',
        check_number: '1234', memo: 'Roof work',
    },
];

const mockFetch = (report: any = REPORT) => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/expenses/report/transactions')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true, data: DRILL_ROWS, total: 2500.00 }),
            });
        }
        if (url.includes('/api/expenses/report')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true, data: report }),
            });
        }
        // categories
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: [{ id: 'a', gl_code: 'EXP001', name: 'Salary/Allowance' }] }),
        });
    });
};

beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
});

describe('ExpenseReport', () => {
    it('renders the summary cards from the server payload', async () => {
        mockFetch();
        render(<ExpenseReport />);

        // Appears in the YTD card and in three table footers, all reading the
        // same server figure.
        expect((await screen.findAllByText('$9,440.75')).length).toBeGreaterThanOrEqual(3);
        expect(screen.getAllByText('$40.00').length).toBeGreaterThan(0);    // current month
        expect(screen.getByText('$3,146.92')).toBeInTheDocument();          // average
        expect(screen.getAllByText('Salary/Allowance').length).toBeGreaterThan(0);

        // Scoped to the card: the count also appears in the trend footer.
        const countCard = screen.getByText('expenseReport.cards.count').closest('div')!;
        expect(within(countCard).getByText('7')).toBeInTheDocument();
    });

    it('shows every month in the range, zero months included', async () => {
        const withEmptyMonth = {
            ...REPORT,
            months: [
                ...REPORT.months,
                { month: '2026-10', short_label: 'Oct', label: 'Oct 2026', long_label: 'October 2026', total: 0, count: 0 },
            ],
        };
        mockFetch(withEmptyMonth);
        render(<ExpenseReport />);

        expect(await screen.findByText('October 2026')).toBeInTheDocument();
        expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
    });

    it('surfaces uncategorized spending rather than hiding it', async () => {
        mockFetch();
        render(<ExpenseReport />);

        expect(await screen.findByText('expenseReport.uncategorizedBanner.title')).toBeInTheDocument();
        expect(screen.getAllByText('Uncategorized / Needs Review').length).toBeGreaterThan(0);
        expect(screen.getAllByText('$1,790.25').length).toBeGreaterThan(0);
    });

    it('omits the uncategorized banner when everything is categorized', async () => {
        mockFetch({
            ...REPORT,
            summary: { ...REPORT.summary, uncategorized_total: 0, uncategorized_count: 0 },
        });
        render(<ExpenseReport />);

        await screen.findAllByText('$9,440.75');
        expect(screen.queryByText('expenseReport.uncategorizedBanner.title')).not.toBeInTheDocument();
    });

    it('renders a matrix whose totals row matches the grand total', async () => {
        mockFetch();
        render(<ExpenseReport />);

        await screen.findAllByText('$9,440.75');
        // Grand total appears in the trend footer, the matrix footer and the
        // category footer — all reading the same server figure.
        expect(screen.getAllByText('$9,440.75').length).toBeGreaterThanOrEqual(3);
        expect(screen.getAllByText('$5,000.00').length).toBeGreaterThan(0);
        expect(screen.getAllByText('$1,750.25').length).toBeGreaterThan(0);
    });

    it('opens the drill-down when a matrix cell is clicked', async () => {
        mockFetch();
        render(<ExpenseReport />);

        await screen.findAllByText('$9,440.75');
        fireEvent.click(screen.getAllByText('$2,500.00')[0]);

        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('ABC Construction')).toBeInTheDocument();
        expect(within(dialog).getByText('Chase + Expense')).toBeInTheDocument();
        expect(within(dialog).getByText('expenseReport.status.matched')).toBeInTheDocument();
    });

    it('asks the server for the clicked cell, not the whole report', async () => {
        mockFetch();
        render(<ExpenseReport />);

        await screen.findAllByText('$9,440.75');
        fireEvent.click(screen.getAllByText('$2,500.00')[0]);

        await waitFor(() => {
            const urls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
            const drill = urls.find((u) => u.includes('/report/transactions'));
            expect(drill).toContain('gl_code=EXP102');
            expect(drill).toContain('month=2026-08');
        });
    });

    it('sends the active filters to the report endpoint', async () => {
        mockFetch();
        render(<ExpenseReport />);
        await screen.findAllByText('$9,440.75');

        fireEvent.change(screen.getByLabelText('expenseReport.filters.startDate'), {
            target: { value: '2026-08-01' },
        });

        await waitFor(() => {
            const urls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
            expect(urls.some((u) => u.includes('start_date=2026-08-01'))).toBe(true);
        });
    });

    it('reports a failed load instead of rendering empty totals', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            json: () => Promise.resolve({ success: false, message: 'Access denied.' }),
        });
        render(<ExpenseReport />);

        expect(await screen.findByText('Access denied.')).toBeInTheDocument();
        expect(screen.queryByText('expenseReport.monthly.title')).not.toBeInTheDocument();
    });
});
