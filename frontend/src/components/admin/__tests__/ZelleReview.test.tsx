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

// A URL-aware mock: the queue endpoint returns `items`, the member search
// endpoint returns `searchResults`, and everything else (the match POST)
// succeeds. Needed once a test drives the row's member search, since a
// single blanket mock can no longer serve both the queue load and the
// search lookup with different payloads.
const mockQueueAndSearch = (items: any[], searchResults: any[]) => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (String(url).includes('/api/members/search')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true, data: { results: searchResults } }),
            });
        }
        if (String(url).includes('/api/zelle/queue')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    success: true,
                    items,
                    pagination: { total: items.length, page: 1, pages: 1 },
                }),
            });
        }
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
        });
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
        expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
        expect(screen.queryByPlaceholderText(/search member/i)).not.toBeInTheDocument();
    });

    test('offers a member search in the Match column and posts the selected member to the match endpoint', async () => {
        mockQueueAndSearch(
            [queueItem],
            [{ id: 7, name: 'Selected Member', phoneNumber: '+15555550123', isActive: true }]
        );
        render(<ZelleReview />);
        await waitFor(() => screen.getByText('SYNTHETIC PAYER'));

        // No raw numeric member-id field: the treasurer must search by name.
        expect(screen.queryByPlaceholderText(/member id/i)).not.toBeInTheDocument();

        const saveButton = screen.getByRole('button', { name: /save/i });
        // Save is disabled until a member has actually been picked from search
        // results — proves the button can't silently post a stale/empty match.
        expect(saveButton).toBeDisabled();

        const searchInput = screen.getByPlaceholderText(/search member by name or phone/i);
        fireEvent.change(searchInput, { target: { value: 'Sel' } });

        const resultButton = await waitFor(() => screen.getByRole('button', { name: /Selected Member/i }));
        fireEvent.mouseDown(resultButton);

        // The chosen member's name must be visible before the treasurer commits the match.
        await waitFor(() => expect(screen.getByText('Selected: Selected Member')).toBeInTheDocument());
        expect(saveButton).not.toBeDisabled();

        fireEvent.click(saveButton);

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

    // The backend rejects a match with no payer name (400 PAYER_NAME_REQUIRED),
    // because the learned key is built from that name — without it the match
    // would save and teach bank reconciliation nothing. The UI must enforce the
    // same rule up front rather than letting the treasurer discover it as a
    // server error after filling the rest of the row in.
    test('keeps Save disabled until a payer name is supplied when the email had none', async () => {
        mockQueueAndSearch(
            [{ ...queueItem, payer_name: null }],
            [{ id: 7, name: 'Selected Member', phoneNumber: '+15555550123', isActive: true }]
        );
        render(<ZelleReview />);
        await waitFor(() => screen.getByPlaceholderText(/payer name/i));

        const saveButton = screen.getByRole('button', { name: /save/i });
        const searchInput = screen.getByPlaceholderText(/search member by name or phone/i);
        fireEvent.change(searchInput, { target: { value: 'Sel' } });
        const resultButton = await waitFor(() => screen.getByRole('button', { name: /Selected Member/i }));
        fireEvent.mouseDown(resultButton);
        await waitFor(() => expect(screen.getByText('Selected: Selected Member')).toBeInTheDocument());

        // A member is chosen, but this row's payer name is still blank.
        expect(saveButton).toBeDisabled();
        expect(screen.getByText(/payer name is required/i)).toBeInTheDocument();
        // The disabled button must say why it is disabled — a treasurer who
        // reaches for Save should not have to infer the blocker from layout.
        expect(saveButton).toHaveAttribute('title', 'Enter the payer name for this row first');

        // Whitespace is not a payer name.
        fireEvent.change(screen.getByPlaceholderText(/payer name/i), { target: { value: '   ' } });
        expect(saveButton).toBeDisabled();

        fireEvent.change(screen.getByPlaceholderText(/payer name/i), { target: { value: 'JANE DOE' } });
        expect(saveButton).not.toBeDisabled();
        expect(screen.queryByText(/payer name is required/i)).not.toBeInTheDocument();
    });

    // A row whose email DID carry a payer name must not be gated by a field
    // that isn't even rendered for it.
    test('does not gate Save on a payer name when the email already had one', async () => {
        mockQueueAndSearch(
            [queueItem],
            [{ id: 7, name: 'Selected Member', phoneNumber: '+15555550123', isActive: true }]
        );
        render(<ZelleReview />);
        await waitFor(() => screen.getByText('SYNTHETIC PAYER'));

        expect(screen.queryByPlaceholderText(/payer name/i)).not.toBeInTheDocument();

        const searchInput = screen.getByPlaceholderText(/search member by name or phone/i);
        fireEvent.change(searchInput, { target: { value: 'Sel' } });
        const resultButton = await waitFor(() => screen.getByRole('button', { name: /Selected Member/i }));
        fireEvent.mouseDown(resultButton);

        await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled());
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
