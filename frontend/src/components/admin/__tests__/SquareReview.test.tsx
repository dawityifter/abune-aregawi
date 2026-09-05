import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SquareReview from '../SquareReview';

// Stable identities: returning fresh objects per call makes fetchQueue's
// useCallback unstable, so its effect re-fires on every render and wipes
// transient banners. The real AuthContext value is stable.
const AUTH_VALUE = {
  currentUser: { email: 'treasurer@test.org' },
  firebaseUser: { getIdToken: async () => 'test-token' }
};
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => AUTH_VALUE
}));
jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k })
}));

const ROWS = [
  {
    id: 'row-1',
    square_payment_id: 'sqpmt_1',
    amount: '30.00',
    buyer_name: 'Jane Doe',
    status: 'NEEDS_REVIEW'
  },
  {
    id: 'row-2',
    square_payment_id: 'sqpmt_2',
    amount: '20.00',
    buyer_name: 'John Roe',
    status: 'NEEDS_REVIEW'
  }
];

/** Queue GETs return `rows`; POSTs resolve via `postResponse`. */
function mockApi({ rows = ROWS, postResponse = null as any } = {}) {
  global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
    if (opts?.method === 'POST') {
      return Promise.resolve(postResponse ?? {
        ok: true,
        json: async () => ({
          success: true,
          results: rows.map((r: any) => ({ success: true, square_payment_id: r.square_payment_id }))
        })
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({ success: true, items: rows }) });
  }) as any;
}

const postCalls = () =>
  (global.fetch as jest.Mock).mock.calls.filter(([, o]) => o?.method === 'POST');

const lastPostBody = () => JSON.parse(postCalls()[postCalls().length - 1][1].body);

const nonMemberCheckbox = () =>
  screen.getAllByRole('checkbox')
    .find(el => el.closest('label')?.textContent?.includes('square.nonMemberDonor'))!;

const selectRow = (paymentId: string) =>
  fireEvent.click(screen.getByLabelText(`select-${paymentId}`));

beforeEach(() => {
  jest.clearAllMocks();
  mockApi();
});

it('renders a Square payment row from the queue', async () => {
  render(<SquareReview />);
  await waitFor(() => expect(screen.getByText(/Jane Doe/)).toBeInTheDocument());
});

describe('non-member donor attribution', () => {
  it('reveals a donor name field, pre-filled from the Square buyer name', async () => {
    render(<SquareReview />);
    await screen.findByText(/Jane Doe/);

    expect(screen.queryByLabelText('square.donorName')).not.toBeInTheDocument();

    fireEvent.click(nonMemberCheckbox());

    expect(await screen.findByLabelText('square.donorName')).toHaveValue('Jane Doe');
  });

  it('keeps Confirm disabled until a donor name is present', async () => {
    render(<SquareReview />);
    await screen.findByText(/Jane Doe/);

    const confirmBtn = screen.getAllByText('square.confirm')[0].closest('button')!;
    expect(confirmBtn).toBeDisabled();

    fireEvent.click(nonMemberCheckbox());
    const nameInput = await screen.findByLabelText('square.donorName');
    expect(confirmBtn).toBeEnabled();

    fireEvent.change(nameInput, { target: { value: '   ' } });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: 'Walk-in Visitor' } });
    expect(confirmBtn).toBeEnabled();
  });

  it('sends donor_name with a null member_id on confirm', async () => {
    render(<SquareReview />);
    await screen.findByText(/Jane Doe/);

    fireEvent.click(nonMemberCheckbox());
    fireEvent.change(await screen.findByLabelText('square.donorName'), {
      target: { value: 'Walk-in Visitor' }
    });
    fireEvent.click(screen.getAllByText('square.confirm')[0].closest('button')!);

    await waitFor(() => expect(postCalls().length).toBeGreaterThan(0));
    expect(lastPostBody()).toMatchObject({
      member_id: null,
      donor_name: 'Walk-in Visitor'
    });
  });
});

describe('bulk attribution', () => {
  it('shows the bulk bar with a running count and total once rows are selected', async () => {
    render(<SquareReview />);
    await screen.findByText(/Jane Doe/);

    expect(screen.queryByLabelText('bulk-square.donorName')).not.toBeInTheDocument();

    selectRow('sqpmt_1');
    expect(await screen.findByLabelText('bulk-square.donorName')).toBeInTheDocument();
    expect(screen.getByText(/1 square\.selectedCount · \$30\.00/)).toBeInTheDocument();

    selectRow('sqpmt_2');
    expect(screen.getByText(/2 square\.selectedCount · \$50\.00/)).toBeInTheDocument();
  });

  it('disables bulk confirm until a donor name is entered', async () => {
    render(<SquareReview />);
    await screen.findByText(/Jane Doe/);
    selectRow('sqpmt_1');

    const bulkBtn = (await screen.findByText(/square\.bulkConfirm/)).closest('button')!;
    expect(bulkBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText('bulk-square.donorName'), {
      target: { value: 'Sunday plate' }
    });
    expect(bulkBtn).toBeEnabled();
  });

  it('posts one batch request with the shared donor name for every selected row', async () => {
    render(<SquareReview />);
    await screen.findByText(/Jane Doe/);
    selectRow('sqpmt_1');
    selectRow('sqpmt_2');

    fireEvent.change(screen.getByLabelText('bulk-square.donorName'), {
      target: { value: 'Sunday plate' }
    });
    fireEvent.click((await screen.findByText(/square\.bulkConfirm/)).closest('button')!);

    await waitFor(() => expect(postCalls().length).toBe(1));

    expect(postCalls()[0][0]).toContain('/api/square/reconcile/batch-create');

    const body = lastPostBody();
    expect(body.items).toHaveLength(2);
    body.items.forEach((item: any) => {
      expect(item.member_id).toBeNull();
      expect(item.donor_name).toBe('Sunday plate');
      // Receipts stay per-payment: uniqueness makes a shared value impossible
      expect(item.receipt_number).toBeUndefined();
    });
  });

  it('omits membership_due from the bulk payment type options', async () => {
    render(<SquareReview />);
    await screen.findByText(/Jane Doe/);
    selectRow('sqpmt_1');

    const typeSelect = await screen.findByLabelText('bulk-payment-type');
    const values = Array.from(typeSelect.querySelectorAll('option')).map(o => o.getAttribute('value'));
    expect(values).not.toContain('membership_due');
    expect(values).toContain('donation');
  });

  it('reports per-item failures instead of a blanket success', async () => {
    mockApi({
      postResponse: {
        ok: true,
        json: async () => ({
          success: true,
          results: [
            { success: true, square_payment_id: 'sqpmt_1' },
            { success: false, square_payment_id: 'sqpmt_2', message: 'Transaction already exists' }
          ]
        })
      }
    });

    render(<SquareReview />);
    await screen.findByText(/Jane Doe/);
    selectRow('sqpmt_1');
    selectRow('sqpmt_2');
    fireEvent.change(screen.getByLabelText('bulk-square.donorName'), {
      target: { value: 'Sunday plate' }
    });
    fireEvent.click((await screen.findByText(/square\.bulkConfirm/)).closest('button')!);

    // Re-query on each poll: the queue refresh re-renders and would detach a
    // reference captured by findByText.
    await waitFor(() => {
      expect(screen.getByText(/Transaction already exists/)).toBeInTheDocument();
    });
    expect(screen.getByText(/1 square\.bulkResult, 1 square\.bulkFailed/)).toBeInTheDocument();
  });

  it('clears the selection after a successful bulk confirm', async () => {
    render(<SquareReview />);
    await screen.findByText(/Jane Doe/);
    selectRow('sqpmt_1');
    fireEvent.change(screen.getByLabelText('bulk-square.donorName'), {
      target: { value: 'Sunday plate' }
    });
    fireEvent.click((await screen.findByText(/square\.bulkConfirm/)).closest('button')!);

    await waitFor(() =>
      expect(screen.queryByLabelText('bulk-square.donorName')).not.toBeInTheDocument()
    );
  });
});
