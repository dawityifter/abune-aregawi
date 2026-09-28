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

jest.mock('../../../utils/pledgeBalanceApi', () => ({
    fetchPledgeBalance: jest.fn(() => Promise.resolve(null)),
}));
// eslint-disable-next-line import/first
import { fetchPledgeBalance } from '../../../utils/pledgeBalanceApi';

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

    test('alternates row backgrounds so each payment is easy to follow', async () => {
        mockQueue([
            { ...queueItem, id: 'r1', payer_name: 'ROW ONE' },
            { ...queueItem, id: 'r2', payer_name: 'ROW TWO' },
            { ...queueItem, id: 'r3', payer_name: 'ROW THREE' },
        ]);
        render(<ZelleReview />);

        await waitFor(() => screen.getByText('ROW THREE'));
        const rows = screen.getAllByTestId('zelle-row');
        expect(rows.map(r => r.classList.contains('bg-slate-200'))).toEqual([false, true, false]);
        expect(rows.map(r => r.classList.contains('bg-white'))).toEqual([true, false, true]);
    });

    test('reads from the queue endpoint, not the Gmail preview endpoint', async () => {
        mockQueue();
        render(<ZelleReview />);

        await waitFor(() => screen.getByText('SYNTHETIC PAYER'));
        const urls = (global.fetch as jest.Mock).mock.calls.map(c => String(c[0]));
        expect(urls.some(u => u.includes('/api/zelle/queue'))).toBe(true);
        expect(urls.some(u => u.includes('/api/zelle/preview/gmail'))).toBe(false);
    });

    test('Create stays disabled on a suggested (unconfirmed) member until one is selected', async () => {
        mockQueue([{ ...queueItem, matchedMember: { id: 7, first_name: 'Suggested', last_name: 'Member' } }]);
        render(<ZelleReview />);

        await waitFor(() => screen.getByText('SYNTHETIC PAYER'));
        expect(screen.getByRole('button', { name: 'zelleReview.createTransaction' })).toBeDisabled();
    });

    test('creates from a treasurer-confirmed match with the chosen payment type', async () => {
        const matched = { ...queueItem, status: 'MATCHED', matchedMember: { id: 7, first_name: 'Test', last_name: 'Member' } };
        mockQueueAndSearch([matched], []);
        render(<ZelleReview />);

        await waitFor(() => screen.getByText('SYNTHETIC PAYER'));
        fireEvent.change(screen.getByLabelText('zelleReview.paymentType'), { target: { value: 'tithe' } });
        fireEvent.change(screen.getByLabelText('zelleReview.receiptOptional'), { target: { value: '1234' } });
        fireEvent.click(screen.getByRole('button', { name: 'zelleReview.createTransaction' }));

        await waitFor(() => {
            const call = (global.fetch as jest.Mock).mock.calls.find(c => String(c[0]).includes('/create-transaction'));
            expect(call).toBeTruthy();
        });
        const call = (global.fetch as jest.Mock).mock.calls.find(c => String(c[0]).includes('/create-transaction'))!;
        expect(String(call[0])).toContain('/api/zelle/queue/q-1/create-transaction');
        expect(JSON.parse(call[1].body)).toMatchObject({ member_id: 7, payment_type: 'tithe', receipt_number: '1234' });
        // Amount and date are never sent: the server reads them from the queue row.
        expect(JSON.parse(call[1].body).amount).toBeUndefined();
    });

    test('a possible duplicate lists candidates and attaches on request', async () => {
        const matched = { ...queueItem, status: 'MATCHED', matchedMember: { id: 7, first_name: 'Test', last_name: 'Member' } };
        (global.fetch as jest.Mock).mockImplementation((url: string, init?: any) => {
            if (String(url).includes('/create-transaction')) {
                return Promise.resolve({
                    ok: false, status: 409,
                    json: () => Promise.resolve({
                        success: false, code: 'POSSIBLE_DUPLICATE',
                        candidates: [{ transaction_id: 55, amount: '75.00', payment_date: '2026-08-19', origin: 'manual' }]
                    })
                });
            }
            if (String(url).includes('/attach')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true, items: [matched], pagination: { total: 1, page: 1, pages: 1 } })
            });
        });
        render(<ZelleReview />);

        await waitFor(() => screen.getByText('SYNTHETIC PAYER'));
        fireEvent.click(screen.getByRole('button', { name: 'zelleReview.createTransaction' }));
        await waitFor(() => screen.getByText('zelleReview.duplicate.title'));
        expect(screen.getByText(/#55/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'zelleReview.duplicate.attach' }));
        await waitFor(() => {
            const call = (global.fetch as jest.Mock).mock.calls.find(c => String(c[0]).includes('/attach'));
            expect(call && JSON.parse(call[1].body)).toEqual({ transaction_id: 55 });
        });
    });

    test('shows where a posted email stands against the bank', async () => {
        mockQueue([
            { ...queueItem, id: 'a', status: 'BANK_POSTED', transaction_id: 1, payer_name: 'P ONE' },
            { ...queueItem, id: 'b', status: 'CREATED', transaction_id: 2, bank_transaction_id: 9, payer_name: 'P TWO' },
            { ...queueItem, id: 'c', status: 'CREATED', transaction_id: 3, payment_date: new Date().toISOString().slice(0, 10), payer_name: 'P THREE',
              transaction: { id: 3, external_id: 'zelle:X' } },
            { ...queueItem, id: 'd', status: 'CREATED', transaction_id: 4, payment_date: '2020-01-01', payer_name: 'P FOUR',
              transaction: { id: 4, external_id: 'zelle:Y' } },
        ]);
        render(<ZelleReview />);

        await waitFor(() => screen.getByText('P ONE'));
        expect(screen.getByText('zelleReview.status.postedByBank')).toBeInTheDocument();
        expect(screen.getByText('zelleReview.status.bankConfirmed')).toBeInTheDocument();
        expect(screen.getByText('zelleReview.status.awaitingBank')).toBeInTheDocument();
        expect(screen.getByText('zelleReview.status.awaitingBankDays')).toBeInTheDocument();
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

    describe('Pledge Drive', () => {
        const matched = { ...queueItem, status: 'MATCHED', matchedMember: { id: 7, first_name: 'Test', last_name: 'Member' } };
        const createBody = () => {
            const call = (global.fetch as jest.Mock).mock.calls.find(c => String(c[0]).includes('/create-transaction'));
            return call ? JSON.parse(call[1].body) : null;
        };

        beforeEach(() => (fetchPledgeBalance as jest.Mock).mockReset());

        test('shows the open pledge and credits it without opening another', async () => {
            (fetchPledgeBalance as jest.Mock).mockResolvedValue({
                id: 1, campaign_id: 1, campaign_name: 'Building Drive', pledged_amount: 1000, paid_amount: 200, remaining_amount: 800,
            });
            mockQueueAndSearch([matched], []);
            render(<ZelleReview />);

            await waitFor(() => screen.getByText('SYNTHETIC PAYER'));
            fireEvent.change(screen.getByLabelText('zelleReview.paymentType'), { target: { value: 'pledge_drive' } });
            await waitFor(() => screen.getByTestId('zelle-open-pledge'));
            expect(fetchPledgeBalance).toHaveBeenCalledWith(7);
            expect(screen.getByText('Building Drive')).toBeInTheDocument();
            expect(screen.queryByText('fundraising.alsoRecordPledge')).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'zelleReview.createTransaction' }));
            await waitFor(() => expect(createBody()).not.toBeNull());
            expect(createBody()).toMatchObject({ member_id: 7, payment_type: 'pledge_drive' });
            expect(createBody().pledge_amount).toBeUndefined();
        });

        test('with no open pledge, can record one with the payment', async () => {
            (fetchPledgeBalance as jest.Mock).mockResolvedValue(null);
            mockQueueAndSearch([matched], []);
            render(<ZelleReview />);

            await waitFor(() => screen.getByText('SYNTHETIC PAYER'));
            fireEvent.change(screen.getByLabelText('zelleReview.paymentType'), { target: { value: 'pledge_drive' } });
            await waitFor(() => screen.getByText('zelleReview.pledge.noOpenPledge'));

            fireEvent.click(screen.getByLabelText('fundraising.alsoRecordPledge'));
            // Defaults to the payment amount: paid in full.
            expect(screen.getByLabelText('fundraising.pledgeAmountLabel')).toHaveValue(75);
            expect(screen.getByText('zelleReview.pledge.paidInFull')).toBeInTheDocument();

            fireEvent.change(screen.getByLabelText('fundraising.pledgeAmountLabel'), { target: { value: '1000' } });
            expect(screen.getByText('zelleReview.pledge.leavesOutstanding')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'zelleReview.createTransaction' }));
            await waitFor(() => expect(createBody()).not.toBeNull());
            expect(createBody().pledge_amount).toBe(1000);
        });

        test('does not look up a pledge for other payment types', async () => {
            mockQueueAndSearch([matched], []);
            render(<ZelleReview />);
            await waitFor(() => screen.getByText('SYNTHETIC PAYER'));
            expect(fetchPledgeBalance).not.toHaveBeenCalled();
        });

        test('reports a pledge that could not be recorded, separately from the payment', async () => {
            (fetchPledgeBalance as jest.Mock).mockResolvedValue(null);
            (global.fetch as jest.Mock).mockImplementation((url: string) => {
                if (String(url).includes('/create-transaction')) {
                    return Promise.resolve({
                        ok: true, status: 201,
                        json: () => Promise.resolve({ success: true, data: { id: 1 }, pledge_error: 'No pledge drive is currently open' }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true, items: [matched], pagination: { total: 1, page: 1, pages: 1 } }),
                });
            });
            render(<ZelleReview />);

            await waitFor(() => screen.getByText('SYNTHETIC PAYER'));
            fireEvent.change(screen.getByLabelText('zelleReview.paymentType'), { target: { value: 'pledge_drive' } });
            await waitFor(() => screen.getByText('zelleReview.pledge.noOpenPledge'));
            fireEvent.click(screen.getByLabelText('fundraising.alsoRecordPledge'));
            fireEvent.click(screen.getByRole('button', { name: 'zelleReview.createTransaction' }));

            await waitFor(() => screen.getByText('zelleReview.pledge.notRecorded'));
            expect(screen.getByText('No pledge drive is currently open')).toBeInTheDocument();
            expect(screen.getByText('zelleReview.created')).toBeInTheDocument();
        });
    });
});

// "Paid on behalf of": crediting this payment to a member must not teach the
// matcher who the sender is unless the treasurer says so.
describe('ZelleReview — who is the sender?', () => {
    const createBody = async () => {
        await waitFor(() => {
            expect((global.fetch as jest.Mock).mock.calls.some(c => String(c[0]).includes('/create-transaction'))).toBe(true);
        });
        const call = (global.fetch as jest.Mock).mock.calls.find(c => String(c[0]).includes('/create-transaction'))!;
        return JSON.parse(call[1].body);
    };

    const onBehalfRow = {
        ...queueItem,
        status: 'MATCHED',
        match_source: 'TREASURER_MATCH:THIS_PAYMENT_ONLY',
        matchedMember: { id: 8, first_name: 'Hana', last_name: 'Pledger' },
        sender_known_as: [{ id: 3, first_name: 'Abel', last_name: 'Sender' }],
    };

    test('a row matched "this payment only" creates without teaching the matcher', async () => {
        mockQueueAndSearch([onBehalfRow], []);
        render(<ZelleReview />);

        await waitFor(() => screen.getByText('SYNTHETIC PAYER'));
        expect(screen.getByLabelText('zelleReview.senderLink.thisPaymentOnly')).toBeChecked();
        fireEvent.click(screen.getByRole('button', { name: 'zelleReview.createTransaction' }));

        expect(await createBody()).toMatchObject({ member_id: 8, remember_sender: false });
    });

    test('"Remember" is sent when the treasurer chooses it', async () => {
        mockQueueAndSearch([onBehalfRow], []);
        render(<ZelleReview />);

        await waitFor(() => screen.getByText('SYNTHETIC PAYER'));
        fireEvent.click(screen.getByLabelText('zelleReview.senderLink.remember'));
        fireEvent.click(screen.getByRole('button', { name: 'zelleReview.createTransaction' }));

        expect(await createBody()).toMatchObject({ member_id: 8, remember_sender: true });
    });

    test('no question when the sender is already remembered as the member', async () => {
        const own = { ...onBehalfRow, match_source: 'TREASURER_MATCH', sender_known_as: [{ id: 8, first_name: 'Hana', last_name: 'Pledger' }] };
        mockQueueAndSearch([own], []);
        render(<ZelleReview />);

        await waitFor(() => screen.getByText('SYNTHETIC PAYER'));
        expect(screen.queryByText('zelleReview.senderLink.title')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'zelleReview.createTransaction' }));

        expect(await createBody()).not.toHaveProperty('remember_sender');
    });
});
