import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import BankTransactionList from '../BankTransactionList';

jest.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

jest.mock('../../../contexts/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}));

global.fetch = jest.fn();

/**
 * Categorizing several debits at once. The confirmation is the point: the
 * treasurer sees the rows and their total before one category is applied to
 * all of them, so a wrong choice is obvious before it is committed rather
 * than after.
 */
const JULY = {
    id: 11,
    date: '2026-07-28',
    amount: -189.99,
    description: 'Spectrum 855-707-7328 MO 07/28',
    type: 'DEBIT_CARD',
    status: 'PENDING',
    payer_name: null,
    check_number: null,
};

const AUGUST = {
    id: 12,
    date: '2026-08-28',
    amount: -194.99,
    description: 'Spectrum 855-707-7328 MO 08/28',
    type: 'DEBIT_CARD',
    status: 'PENDING',
    payer_name: null,
    check_number: null,
};

const CATEGORIES = [
    { gl_code: 'EXP006', name: 'Cable', is_active: true },
    { gl_code: 'EXP104', name: 'Supplies', is_active: true },
];

/** Routes each request the screen makes to the right canned response. */
function mockApi(onBulk?: (body: any) => void) {
    (global.fetch as jest.Mock).mockImplementation((url: string, init?: any) => {
        if (String(url).includes('/api/expenses/categories')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true, data: CATEGORIES }),
            });
        }
        if (String(url).includes('/api/bank/reconcile-expense-bulk')) {
            onBulk?.(JSON.parse(init.body));
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    success: true,
                    data: { recorded: 2, learned: true, gl_code: 'EXP006' },
                }),
            });
        }
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                success: true,
                data: {
                    transactions: [JULY, AUGUST],
                    pagination: { pages: 1 },
                    current_balance: 1000,
                },
            }),
        });
    });
}

async function selectRow(description: RegExp) {
    const cell = await screen.findByText(description);
    const row = cell.closest('tr') as HTMLElement;
    fireEvent.click(row.querySelector('input[type="checkbox"]') as HTMLInputElement);
}

async function openBulkExpense() {
    render(<BankTransactionList refreshTrigger={0} />);
    await waitFor(() => screen.getByText(/07\/28/));
    await selectRow(/07\/28/);
    await selectRow(/08\/28/);
    fireEvent.click(await screen.findByRole('button', { name: /Categorize 2 Expenses/i }));
    return screen.findByRole('dialog', { name: /Record .* as Expenses/i });
}

describe('Bulk expense modal', () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockReset();
        jest.spyOn(window, 'confirm').mockReturnValue(true);
        jest.spyOn(window, 'alert').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('offers the categorize action for a debit-only selection', async () => {
        mockApi();
        render(<BankTransactionList refreshTrigger={0} />);
        await waitFor(() => screen.getByText(/07\/28/));
        await selectRow(/07\/28/);

        expect(await screen.findByRole('button', { name: /Categorize 1 Expense/i })).toBeInTheDocument();
    });

    it('lists the rows it is about to file', async () => {
        mockApi();
        const dialog = await openBulkExpense();

        expect(within(dialog).getByText(/07\/28/)).toBeInTheDocument();
        expect(within(dialog).getByText(/08\/28/)).toBeInTheDocument();
    });

    it('shows the batch total so a wrong selection is visible before committing', async () => {
        mockApi();
        const dialog = await openBulkExpense();

        // 189.99 + 194.99
        expect(within(dialog).getByText(/\$384\.98/)).toBeInTheDocument();
    });

    it('will not submit without a category', async () => {
        mockApi();
        const dialog = await openBulkExpense();

        const submit = within(dialog).getByRole('button', { name: /Record 2 Expenses/i });
        expect(submit).toBeDisabled();
    });

    it('sends the selected rows and the chosen category', async () => {
        let sent: any = null;
        mockApi((body) => { sent = body; });
        const dialog = await openBulkExpense();

        fireEvent.change(within(dialog).getByLabelText(/Expense Category/i), {
            target: { value: 'EXP006' },
        });
        fireEvent.change(within(dialog).getByLabelText(/Payee/i), {
            target: { value: 'Spectrum' },
        });
        fireEvent.click(within(dialog).getByRole('button', { name: /Record 2 Expenses/i }));

        await waitFor(() => expect(sent).not.toBeNull());
        expect(sent.transaction_ids).toEqual([11, 12]);
        expect(sent.gl_code).toBe('EXP006');
        expect(sent.payee_name).toBe('Spectrum');
    });

    it('closes once the batch is recorded', async () => {
        mockApi();
        const dialog = await openBulkExpense();

        fireEvent.change(within(dialog).getByLabelText(/Expense Category/i), {
            target: { value: 'EXP006' },
        });
        fireEvent.click(within(dialog).getByRole('button', { name: /Record 2 Expenses/i }));

        await waitFor(() =>
            expect(screen.queryByRole('dialog', { name: /Record .* as Expenses/i })).not.toBeInTheDocument()
        );
    });
});
