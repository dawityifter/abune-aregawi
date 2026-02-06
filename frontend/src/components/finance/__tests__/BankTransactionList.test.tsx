import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BankTransactionList from '../BankTransactionList';

// Mock mocks
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

// Mock API call
global.fetch = jest.fn();

describe('BankTransactionList Year Selection', () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockReset();
    });

    test('should show Year dropdown only when Membership Due is selected', async () => {
        // Mock transaction data
        const mockTransactions = [
            {
                id: 1,
                date: '2026-02-01',
                amount: 100,
                description: 'Test Payment',
                type: 'credit',
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
            expect(screen.getByText('Test Payment')).toBeInTheDocument();
        });

        // Click "Link and Add Transaction"
        // Note: The button text might be different based on screen size or exact text in component
        // Searching for "Link and Add Transaction" button
        const linkBtn = screen.getByText('Link and Add Transaction');
        fireEvent.click(linkBtn);

        // Verify Modal matches text
        expect(screen.getByText('Link Transaction to Member')).toBeInTheDocument();

        // Check Payment Type dropdown
        // It likely defaults to 'donation' (first option)
        // Find select by Label "Payment Type"
        const typeSelect = screen.getByLabelText('Payment Type');

        // Year dropdown should NOT be visible initially (for donation)
        const yearLabel = screen.queryByLabelText('Year (Optional)');
        expect(yearLabel).not.toBeInTheDocument();

        // Change to "Membership Due"
        fireEvent.change(typeSelect, { target: { value: 'membership_due' } });

        // Now Year dropdown SHOULD be visible
        const yearSelect = screen.getByLabelText('Year (Optional)');
        expect(yearSelect).toBeInTheDocument();

        // Verify Options (2025 up to currentYear - 1)
        // Assuming current year >= 2026.
        // If current year is 2026, options: 2025.
        // If current year is 2025, maxYear = 2024, minYear = 2025 -> loop doesn't run? 
        // Logic was: for (let y = maxYear; y >= minYear; y--)
        // If current is 2025, max = 2024. Loop 2024 >= 2025 is false. Options empty.
        // Wait, logic in component:
        // const currentYear = new Date().getFullYear();
        // const maxYear = currentYear - 1;
        // const minYear = 2025;
        // So if it's 2026, max=2025. Options: 2025.

        // We can't strictly assert the options without knowing the execution year, 
        // but we can check it exists.
    });
});
