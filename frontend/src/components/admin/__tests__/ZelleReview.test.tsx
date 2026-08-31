import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ZelleReview from '../ZelleReview';

jest.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({
        currentUser: { id: 1, role: 'treasurer' },
        firebaseUser: { getIdToken: () => Promise.resolve('mock-token') }
    }),
}));

jest.mock('../../../contexts/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}));

global.fetch = jest.fn();

const queueItem = {
    id: 'q-1',
    external_id: 'zelle:TESTREF123456',
    payer_name: 'SYNTHETIC PAYER',
    amount: '75.00',
    payment_date: '2026-08-20',
    note: 'SYNTHETIC PAYER sent you $75.00',
    status: 'NEEDS_REVIEW',
    transaction_id: null,
    matchedMember: null,
};

const mockQueue = (items: any[] = [queueItem]) => {
    (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
            success: true,
            items,
            pagination: { total: items.length, page: 1, pages: 1 },
        }),
    });
};

describe('ZelleReview (match-only)', () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockReset();
    });

    test('renders the queue row with date, amount, payer and memo', async () => {
        mockQueue();
        render(<ZelleReview />);

        await waitFor(() => screen.getByText('SYNTHETIC PAYER'));
        expect(screen.getByText('2026-08-20')).toBeInTheDocument();
        // Exact match, not a /75\.00/ regex: the memo text below also contains
        // "$75.00" as a substring ("...sent you $75.00"), so a substring regex
        // matches both the Amount and Memo cells and getByText correctly
        // throws on the ambiguity. An exact match targets the Amount cell only.
        expect(screen.getByText('$75.00')).toBeInTheDocument();
        expect(screen.getByText(/sent you/)).toBeInTheDocument();
    });

    test('reads from the queue endpoint, not the Gmail preview endpoint', async () => {
        mockQueue();
        render(<ZelleReview />);

        await waitFor(() => screen.getByText('SYNTHETIC PAYER'));
        const urls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]));
        expect(urls.some(u => u.includes('/api/zelle/queue'))).toBe(true);
        expect(urls.some(u => u.includes('/api/zelle/preview/gmail'))).toBe(false);
    });

    test('offers no transaction-creating controls', async () => {
        mockQueue();
        render(<ZelleReview />);

        await waitFor(() => screen.getByText('SYNTHETIC PAYER'));
        expect(screen.queryByRole('button', { name: /^create$/i })).not.toBeInTheDocument();
        expect(screen.queryByText(/receipt/i)).not.toBeInTheDocument();
    });

    test('shows an existing match as text with no edit control when already posted', async () => {
        mockQueue([{
            ...queueItem,
            id: 'q-2',
            status: 'AUTO_CREATED',
            transaction_id: 42,
            matchedMember: { id: 7, first_name: 'Test', last_name: 'Member' },
        }]);
        render(<ZelleReview />);

        await waitFor(() => screen.getByText('Test Member'));
        expect(screen.queryByRole('button', { name: /match/i })).not.toBeInTheDocument();
    });

    test('posts to the match endpoint when a member is saved', async () => {
        mockQueue();
        render(<ZelleReview />);
        await waitFor(() => screen.getByText('SYNTHETIC PAYER'));

        fireEvent.change(screen.getByPlaceholderText(/member id/i), { target: { value: '7' } });
        fireEvent.click(screen.getByRole('button', { name: /match/i }));

        await waitFor(() => {
            const call = (global.fetch as jest.Mock).mock.calls
                .find(c => String(c[0]).includes('/queue/q-1/match'));
            expect(call).toBeDefined();
            expect(call[1].method).toBe('POST');
            expect(JSON.parse(call[1].body)).toMatchObject({ member_id: 7 });
        });
    });

    test('asks for a payer name when the email could not be parsed', async () => {
        mockQueue([{ ...queueItem, payer_name: null }]);
        render(<ZelleReview />);

        await waitFor(() => screen.getByPlaceholderText(/payer name/i));
    });

    test('debounces the search input to one fetch instead of one per keystroke', async () => {
        jest.useFakeTimers();
        try {
            mockQueue();
            render(<ZelleReview />);
            await waitFor(() => screen.getByText('SYNTHETIC PAYER'));

            const queueFetchCount = () =>
                (global.fetch as jest.Mock).mock.calls.filter(c => String(c[0]).includes('/api/zelle/queue')).length;
            const countAfterMount = queueFetchCount();

            const input = screen.getByPlaceholderText(/filter by memo or payer/i);
            act(() => {
                fireEvent.change(input, { target: { value: 'S' } });
                fireEvent.change(input, { target: { value: 'SY' } });
                fireEvent.change(input, { target: { value: 'SYN' } });
                fireEvent.change(input, { target: { value: 'SYNT' } });
            });

            // Still within the debounce window: no new request yet.
            expect(queueFetchCount()).toBe(countAfterMount);

            act(() => {
                jest.advanceTimersByTime(300);
            });

            // loadQueue is async: the debounce timer firing only starts it,
            // the actual fetch() call happens after an awaited getIdToken().
            // Flush that microtask before asserting the new call landed.
            await act(async () => {
                await Promise.resolve();
            });

            // Exactly one new request for the whole burst of keystrokes.
            expect(queueFetchCount()).toBe(countAfterMount + 1);
        } finally {
            jest.useRealTimers();
        }
    });
});
