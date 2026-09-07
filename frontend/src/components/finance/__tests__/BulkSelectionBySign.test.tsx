import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
 * Selecting rows in bulk means something different depending on which way the
 * money went. A deposit is linked to a member with a payment type; a debit is
 * money spent and belongs to an expense with a category and a payee.
 *
 * The toolbar used to offer the member flow for any selection, so selecting
 * debits led to a dialog asking which member had donated them.
 */
const CREDIT = {
    id: 1,
    date: '2026-02-01',
    amount: 100,
    description: 'Zelle payment from A DONOR 123',
    type: 'ZELLE',
    status: 'PENDING',
    payer_name: 'A DONOR',
    check_number: null,
};

const DEBIT = {
    id: 2,
    date: '2026-02-03',
    amount: -194.99,
    description: 'Spectrum 855-707-7328 MO   02/03',
    type: 'DEBIT_CARD',
    status: 'PENDING',
    payer_name: null,
    check_number: null,
};

const setupFetchMock = (transactions: any[]) => {
    (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
            Promise.resolve({
                success: true,
                data: { transactions, pagination: { pages: 1 }, current_balance: 1000 },
            }),
    });
};

/** Tick the row checkbox for a transaction, identified by its description. */
async function selectRow(description: RegExp) {
    const cell = await screen.findByText(description);
    const row = cell.closest('tr') as HTMLElement;
    const box = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(box);
}

async function showList(transactions: any[]) {
    setupFetchMock(transactions);
    render(<BankTransactionList refreshTrigger={0} />);
    await waitFor(() => screen.getByText(/Zelle payment from A DONOR/));
}

describe('Bulk selection depends on which way the money went', () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockReset();
        jest.spyOn(window, 'confirm').mockReturnValue(true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('offers the member link for a deposit-only selection', async () => {
        await showList([CREDIT, DEBIT]);
        await selectRow(/Zelle payment from A DONOR/);

        expect(await screen.findByRole('button', { name: /Link 1 Transaction/i })).toBeInTheDocument();
    });

    it('does not offer the member link for a debit-only selection', async () => {
        await showList([CREDIT, DEBIT]);
        await selectRow(/Spectrum/);

        await waitFor(() =>
            expect(screen.queryByRole('button', { name: /Link 1 Transaction/i })).not.toBeInTheDocument()
        );
    });

    it('explains what to do with selected debits instead', async () => {
        await showList([CREDIT, DEBIT]);
        await selectRow(/Spectrum/);

        expect(await screen.findByText(/recorded as expenses/i)).toBeInTheDocument();
    });

    it('refuses a mixed selection rather than acting on half of it', async () => {
        await showList([CREDIT, DEBIT]);
        await selectRow(/Zelle payment from A DONOR/);
        await selectRow(/Spectrum/);

        expect(await screen.findByText(/not both/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Link 2 Transactions/i })).not.toBeInTheDocument();
    });

    it('offers nothing at all when nothing is selected', async () => {
        await showList([CREDIT, DEBIT]);

        expect(screen.queryByRole('button', { name: /Link .* Transaction/i })).not.toBeInTheDocument();
        expect(screen.queryByText(/recorded as expenses/i)).not.toBeInTheDocument();
    });
});
