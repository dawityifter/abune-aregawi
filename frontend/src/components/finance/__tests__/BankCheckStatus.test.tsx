import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BankTransactionList, { BankTransaction } from '../BankTransactionList';

jest.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

jest.mock('../../../contexts/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}));

global.fetch = jest.fn();

const baseCheck: Partial<BankTransaction> = {
    id: 1,
    date: '2026-02-01',
    amount: -250,
    description: 'CHECK #1593',
    type: 'CHECK_PAID',
    status: 'PENDING',
    payer_name: null,
    check_number: '1593',
};

const setupFetchMock = (transactions: Partial<BankTransaction>[]) => {
    (global.fetch as jest.Mock).mockResolvedValue({
        json: () =>
            Promise.resolve({
                success: true,
                data: { transactions, pagination: { pages: 1 }, current_balance: 1000 },
            }),
    });
};

beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
});

describe('BankTransactionList — check reconciliation status', () => {
    it('shows an unmatched cleared check as NOT RECONCILED', async () => {
        setupFetchMock([{
            ...baseCheck,
            check_status: { state: 'NOT_RECONCILED', reason: 'NO_MANUAL_ENTRY', check_number: '1593', bank_amount: 250 },
        }]);
        render(<BankTransactionList refreshTrigger={0} />);

        expect(await screen.findByText('NOT RECONCILED')).toBeInTheDocument();
    });

    it('renders the unreconciled badge in red, not the amber pending styling', async () => {
        setupFetchMock([{
            ...baseCheck,
            check_status: { state: 'NOT_RECONCILED', reason: 'NO_MANUAL_ENTRY', check_number: '1593', bank_amount: 250 },
        }]);
        render(<BankTransactionList refreshTrigger={0} />);

        const badge = await screen.findByText('NOT RECONCILED');
        expect(badge.className).toMatch(/red/);
    });

    it('explains that no expense was entered for the check', async () => {
        setupFetchMock([{
            ...baseCheck,
            check_status: { state: 'NOT_RECONCILED', reason: 'NO_MANUAL_ENTRY', check_number: '1593', bank_amount: 250 },
        }]);
        render(<BankTransactionList refreshTrigger={0} />);

        expect(await screen.findByText(/no expense recorded for check #1593/i)).toBeInTheDocument();
    });

    it('shows both amounts when the check number matches but the amount does not', async () => {
        setupFetchMock([{
            ...baseCheck,
            check_status: {
                state: 'NOT_RECONCILED',
                reason: 'AMOUNT_MISMATCH',
                check_number: '1593',
                bank_amount: 250,
                expense_amount: 205,
            },
        }]);
        render(<BankTransactionList refreshTrigger={0} />);

        const note = await screen.findByText(/expense recorded as/i);
        expect(note.textContent).toMatch(/check #1593/i);
        expect(note.textContent).toMatch(/\$205\.00/);
        expect(note.textContent).toMatch(/\$250\.00/);
    });

    it('shows a matched check as reconciled', async () => {
        setupFetchMock([{
            ...baseCheck,
            status: 'MATCHED',
            reconciled_source: 'AUTO_CHECK_MATCH',
            check_status: { state: 'RECONCILED', check_number: '1593' },
        }]);
        render(<BankTransactionList refreshTrigger={0} />);

        expect(await screen.findByText('RECONCILED')).toBeInTheDocument();
        expect(screen.queryByText('NOT RECONCILED')).not.toBeInTheDocument();
    });

    it('leaves a non-check pending row with its normal pending label', async () => {
        setupFetchMock([{
            ...baseCheck,
            type: 'ZELLE',
            description: 'Zelle payment from SOMEONE',
            check_number: null,
            check_status: undefined,
        }]);
        render(<BankTransactionList refreshTrigger={0} />);

        expect(await screen.findByText('PENDING REVIEW')).toBeInTheDocument();
        expect(screen.queryByText('NOT RECONCILED')).not.toBeInTheDocument();
    });
});
