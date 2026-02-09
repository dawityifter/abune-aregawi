import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BankTransactionList from '../BankTransactionList';

// Mock contexts
jest.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({
        firebaseUser: {
            getIdToken: () => Promise.resolve('mock-token'),
        },
    }),
}));

jest.mock('../../../contexts/LanguageContext', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}));

// Mock fetch
global.fetch = jest.fn();

describe('BankTransactionList Year Selection', () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockReset();
    });

    test('should show Year dropdown only when Membership Due is selected', async () => {
        const mockTransactions = [
            {
                id: 1,
                date: '2026-02-01',
                amount: 100,
                description: 'Test Zelle Payment',
                type: 'ZELLE',
                status: 'PENDING',
                payer_name: 'John Doe',
            },
        ];

        (global.fetch as jest.Mock).mockResolvedValue({
            json: () => Promise.resolve({
                success: true,
                data: {
                    transactions: mockTransactions,
                    pagination: { pages: 1 },
                    current_balance: 1000
                }
            }),
        });

        render(<BankTransactionList refreshTrigger={0} />);

        // Wait for data to load
        await waitFor(() => {
            expect(screen.getByText('Test Zelle Payment')).toBeInTheDocument();
        });

        // Click per-row "Link and Add Transaction" button
        const linkBtn = screen.getByText('Link and Add Transaction');
        fireEvent.click(linkBtn);

        // Verify modal opens
        await waitFor(() => {
            expect(screen.getByText('Link Transaction to Donor')).toBeInTheDocument();
        });

        // Check Payment Type dropdown exists
        const typeSelect = screen.getByLabelText('Payment Type');
        expect(typeSelect).toBeInTheDocument();

        // Year dropdown should NOT be visible initially (default is donation)
        expect(screen.queryByLabelText('Year (Optional)')).not.toBeInTheDocument();

        // Change to "Membership Due"
        fireEvent.change(typeSelect, { target: { value: 'membership_due' } });

        // Now Year dropdown SHOULD be visible
        expect(screen.getByLabelText('Year (Optional)')).toBeInTheDocument();
    });
});
