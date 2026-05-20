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

const mockTransactions = [
    {
        id: 1,
        date: '2026-02-01',
        amount: 100,
        description: 'Test Payment',
        type: 'ZELLE',
        status: 'PENDING',
        payer_name: 'John Doe',
        check_number: null,
    },
];

const setupFetchMock = (transactions = mockTransactions, pages = 1) => {
    (global.fetch as jest.Mock).mockResolvedValue({
        json: () =>
            Promise.resolve({
                success: true,
                data: { transactions, pagination: { pages }, current_balance: 1000 },
            }),
    });
};

describe('BankTransactionList', () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockReset();
        jest.spyOn(window, 'confirm').mockReturnValue(true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('shows Details button for each transaction', async () => {
        setupFetchMock();
        render(<BankTransactionList refreshTrigger={0} />);
        await waitFor(() => screen.getByText('Test Payment'));
        expect(screen.getByText('Details →')).toBeInTheDocument();
    });

    test('does not show inline action buttons in table row', async () => {
        setupFetchMock();
        render(<BankTransactionList refreshTrigger={0} />);
        await waitFor(() => screen.getByText('Test Payment'));
        expect(screen.queryByText('Link and Add Transaction')).not.toBeInTheDocument();
        expect(screen.queryByText('Confirm Match')).not.toBeInTheDocument();
        expect(screen.queryByText('Add Expense')).not.toBeInTheDocument();
    });

    test('opens detail panel when Details button is clicked', async () => {
        setupFetchMock();
        render(<BankTransactionList refreshTrigger={0} />);
        await waitFor(() => screen.getByText('Test Payment'));
        fireEvent.click(screen.getByText('Details →'));
        expect(screen.getByRole('dialog', { name: 'Transaction Details' })).toBeInTheDocument();
    });

    test('shows potential duplicate as the existing transaction entry', async () => {
        setupFetchMock([
            {
                ...mockTransactions[0],
                potential_matches: [
                    {
                        id: 77,
                        amount: 100,
                        payment_date: '2026-01-30',
                        payment_type: 'donation',
                        payment_method: 'zelle',
                        receipt_number: 'R-77',
                        member: { first_name: 'Jane', last_name: 'Doe' },
                    },
                ],
            },
        ]);
        render(<BankTransactionList refreshTrigger={0} />);
        await waitFor(() => screen.getByText('Possible existing entry'));
        expect(screen.getByText(/Existing entry #77: Jane Doe, 2026-01-30, receipt R-77/)).toBeInTheDocument();
        expect(screen.queryByText('Potential Duplicate')).not.toBeInTheDocument();
    });

    test('labels ignored bank status as reconciled', async () => {
        setupFetchMock([{ ...mockTransactions[0], status: 'IGNORED' }]);
        render(<BankTransactionList refreshTrigger={0} />);
        await waitFor(() => screen.getByText('RECONCILED'));
        expect(screen.queryByText('IGNORED')).not.toBeInTheDocument();
    });

    test('resets pagination when search changes', async () => {
        setupFetchMock(mockTransactions, 2);
        render(<BankTransactionList refreshTrigger={0} />);
        await waitFor(() => screen.getByText('Test Payment'));

        fireEvent.click(screen.getByText('Next'));
        await waitFor(() =>
            expect((global.fetch as jest.Mock).mock.calls.some(([url]) => String(url).includes('page=2'))).toBe(true)
        );

        fireEvent.change(screen.getByPlaceholderText('Search transactions...'), { target: { value: 'payer' } });
        await waitFor(() =>
            expect((global.fetch as jest.Mock).mock.calls.some(([url]) =>
                String(url).includes('page=1') && String(url).includes('description=payer')
            )).toBe(true)
        );
    });

    test('shows shared suggested member in bulk link modal when all selected transactions agree', async () => {
        setupFetchMock([
            {
                ...mockTransactions[0],
                suggested_match: {
                    type: 'LEARNED_ACH',
                    reason: 'Previously associated with this ACH payer',
                    confidence: 'high',
                    member: { id: 11, first_name: 'Shared', last_name: 'Member' },
                },
            },
            {
                ...mockTransactions[0],
                id: 2,
                description: 'Second Payment',
                suggested_match: {
                    type: 'FUZZY_NAME',
                    reason: 'ACH payer name resembles this member',
                    confidence: 'medium',
                    member: { id: 11, first_name: 'Shared', last_name: 'Member' },
                },
            },
        ]);
        render(<BankTransactionList refreshTrigger={0} />);
        await waitFor(() => screen.getByText('Second Payment'));

        fireEvent.click(screen.getAllByRole('checkbox')[0]);
        fireEvent.click(screen.getByText('Link 2 Transactions'));

        expect(screen.getByText('Shared Suggested Member')).toBeInTheDocument();
        expect(screen.getByText('Every selected transaction suggests this member.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Link 2 Transactions to Shared Member' })).toBeInTheDocument();
    });

    test('closes detail panel when backdrop is clicked', async () => {
        setupFetchMock();
        render(<BankTransactionList refreshTrigger={0} />);
        await waitFor(() => screen.getByText('Test Payment'));
        fireEvent.click(screen.getByText('Details →'));
        expect(screen.getByRole('dialog', { name: 'Transaction Details' })).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('panel-backdrop'));
        expect(screen.queryByRole('dialog', { name: 'Transaction Details' })).not.toBeInTheDocument();
    });
});
