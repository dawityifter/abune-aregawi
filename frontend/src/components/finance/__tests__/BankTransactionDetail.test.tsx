import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import BankTransactionDetail from '../BankTransactionDetail';
import { BankTransaction } from '../BankTransactionList';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import { I18nProvider } from '../../../i18n/I18nProvider';

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

global.fetch = jest.fn();

const renderDetail = (ui: React.ReactElement) => {
  return render(
    <I18nProvider>
      <LanguageProvider>
        {ui}
      </LanguageProvider>
    </I18nProvider>
  );
};

const mockTxn: BankTransaction = {
  id: 42,
  date: '2026-03-28',
  amount: 200,
  description: 'ZELLE FROM DAWIT YIFTER ON 03/28 REF#ABC123',
  type: 'ZELLE',
  status: 'PENDING',
  payer_name: 'Dawit Yifter',
  check_number: null,
};

describe('BankTransactionDetail — shell behavior', () => {
  test('renders nothing when txn is null', () => {
    const { container } = renderDetail(
      <BankTransactionDetail txn={null} onClose={jest.fn()} onSuccess={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('renders panel when txn is provided', () => {
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Transaction Details' })).toBeInTheDocument();
  });

  test('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn();
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.click(screen.getByTestId('panel-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  test('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Close panel'));
    expect(onClose).toHaveBeenCalled();
  });

  test('calls onClose when Escape key is pressed', () => {
    const onClose = jest.fn();
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('BankTransactionDetail — field display', () => {
  test('shows transaction id in header', () => {
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('#TXN-42')).toBeInTheDocument();
  });

  test('shows PENDING status badge', () => {
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('PENDING REVIEW')).toBeInTheDocument();
  });

  test('shows full description without truncation', () => {
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('ZELLE FROM DAWIT YIFTER ON 03/28 REF#ABC123')).toBeInTheDocument();
  });

  test('shows type badge', () => {
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('ZELLE')).toBeInTheDocument();
  });

  test('shows payer name', () => {
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('Dawit Yifter')).toBeInTheDocument();
  });

  test('shows formatted amount', () => {
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('$200.00')).toBeInTheDocument();
  });

  test('does not show check number when null', () => {
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.queryByText(/Check #/)).not.toBeInTheDocument();
  });

  test('shows check number when present', () => {
    const txnWithCheck = { ...mockTxn, check_number: '1042' };
    renderDetail(<BankTransactionDetail txn={txnWithCheck} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('Check #1042')).toBeInTheDocument();
  });

  test('shows MATCHED status badge for matched transaction', () => {
    const matched = {
      ...mockTxn,
      payer_name: 'Bank Payer Name',  // different from member name
      status: 'MATCHED' as const,
      receipt_number: 'ZR-3001',
      member: { first_name: 'Dawit', last_name: 'Yifter' },
    };
    renderDetail(<BankTransactionDetail txn={matched} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('MATCHED')).toBeInTheDocument();
    expect(screen.getByText('Dawit Yifter')).toBeInTheDocument();
    expect(screen.getByText('Receipt Number')).toBeInTheDocument();
    expect(screen.getByText('ZR-3001')).toBeInTheDocument();
  });

  test('labels ignored bank status as reconciled', () => {
    const reconciled = {
      ...mockTxn,
      status: 'IGNORED' as const,
    };
    renderDetail(<BankTransactionDetail txn={reconciled} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('RECONCILED')).toBeInTheDocument();
    expect(screen.queryByText('IGNORED')).not.toBeInTheDocument();
  });

  test('shows possible existing entry details for potential matches', () => {
    const duplicateCandidate: BankTransaction = {
      ...mockTxn,
      potential_matches: [
        {
          id: 77,
          amount: 200,
          payment_date: '2026-03-27',
          payment_type: 'membership_due',
          payment_method: 'zelle',
          receipt_number: 'R-77',
          note: 'Already entered from Sunday collection',
          member: { first_name: 'Dawit', last_name: 'Yifter' },
        },
      ],
    };
    renderDetail(<BankTransactionDetail txn={duplicateCandidate} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('Possible Existing Entry')).toBeInTheDocument();
    expect(screen.getByText('Same amount, same payment method, transaction date within 2 days, and similar payer/member name.')).toBeInTheDocument();
    expect(screen.getByText('Entry #77 - Dawit Yifter')).toBeInTheDocument();
    expect(screen.getByText('2026-03-27 · Membership Due · Zelle')).toBeInTheDocument();
    expect(screen.getByText('Receipt: R-77')).toBeInTheDocument();
    expect(screen.getByText('Already entered from Sunday collection')).toBeInTheDocument();
  });
});

describe('BankTransactionDetail — PENDING income actions', () => {
  const mockTxnWithMatch: BankTransaction = {
    ...mockTxn,
    suggested_match: {
      type: 'donation',
      member: { id: 5, first_name: 'Dawit', last_name: 'Yifter' },
    },
  };

  test('shows suggested match card when suggested_match is present', () => {
    renderDetail(<BankTransactionDetail txn={mockTxnWithMatch} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('Suggested Members')).toBeInTheDocument();
    expect(screen.getAllByText('Dawit Yifter').length).toBeGreaterThan(0);
  });

  test('shows payment type selector for PENDING income', () => {
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByLabelText('Payment Type')).toBeInTheDocument();
  });

  test('shows optional receipt number input for PENDING income', () => {
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByLabelText('Receipt Number (Optional)')).toBeInTheDocument();
  });

  test('year selector hidden when payment type is not membership_due', () => {
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.queryByLabelText('Year (Optional)')).not.toBeInTheDocument();
  });

  test('year selector appears when membership_due is selected', () => {
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Payment Type'), { target: { value: 'membership_due' } });
    expect(screen.getByLabelText('Year (Optional)')).toBeInTheDocument();
  });

  test('selects suggested member before confirming reconcile', () => {
    renderDetail(<BankTransactionDetail txn={mockTxnWithMatch} onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Dawit Yifter/i }));
    expect(screen.getByText('Selected Member')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dawit Yifter/i })).toHaveClass('bg-green-700');
  });

  test('calls /api/bank/reconcile only after explicit confirmation', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    const onSuccess = jest.fn();
    renderDetail(<BankTransactionDetail txn={mockTxnWithMatch} onClose={jest.fn()} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByLabelText('Receipt Number (Optional)'), { target: { value: 'R-1001' } });
    fireEvent.click(screen.getByRole('button', { name: /Dawit Yifter/i }));
    // mockTxnWithMatch is a ZELLE-type row, so the submit button reads
    // "Approve" rather than the generic "Confirm Selected Member" label.
    fireEvent.click(screen.getByRole('button', { name: /^Approve$/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/bank/reconcile'),
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.action).toBe('MATCH');
    expect(body.transaction_id).toBe(42);
    expect(body.member_id).toBe(5);
    expect(body.receipt_number).toBe('1001');
  });

  test('shows multiple suggested member candidates with reasons', () => {
    const txnWithCandidates: BankTransaction = {
      ...mockTxn,
      suggested_matches: [
        {
          type: 'LEARNED_ACH',
          source: 'LEARNED_ACH',
          reason: 'Previously associated with this ACH payer',
          confidence: 'high',
          member: { id: 5, first_name: 'Learned', last_name: 'Member' },
        },
        {
          type: 'FUZZY_NAME',
          source: 'FUZZY_NAME',
          reason: 'ACH payer name resembles this member',
          confidence: 'medium',
          member: { id: 6, first_name: 'Fuzzy', last_name: 'Member' },
        },
      ],
    };

    renderDetail(<BankTransactionDetail txn={txnWithCandidates} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Learned Member/i })).toBeInTheDocument();
    expect(screen.getByText('Previously associated with this ACH payer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fuzzy Member/i })).toBeInTheDocument();
    expect(screen.getByText('ACH payer name resembles this member')).toBeInTheDocument();
  });

  test('confirm button stays disabled until a member is selected', () => {
    // mockTxn is a ZELLE-type row, so the submit button reads "Approve".
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByRole('button', { name: /^Approve$/i })).toBeDisabled();
  });

  test('shows member search input', () => {
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByPlaceholderText(/search member/i)).toBeInTheDocument();
  });

  test('shows Mark Reconciled button for PENDING income', () => {
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('Mark Reconciled')).toBeInTheDocument();
  });

  test('calls /api/bank/reconcile with IGNORE action on Mark Reconciled', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    const onSuccess = jest.fn();
    renderDetail(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText('Mark Reconciled'));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.action).toBe('IGNORE');
    expect(body.transaction_id).toBe(42);
  });
});

describe('BankTransactionDetail — PENDING expense actions', () => {
  const mockExpenseTxn: BankTransaction = {
    id: 43,
    date: '2026-03-20',
    amount: -250,
    description: 'CHECK #1099 TO VENDOR',
    type: 'CHECK',
    status: 'PENDING',
    payer_name: null,
    check_number: '1099',
  };

  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  test('shows Record Expense button for negative-amount PENDING', () => {
    renderDetail(<BankTransactionDetail txn={mockExpenseTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('Record Expense')).toBeInTheDocument();
  });

  test('does not show income action buttons for negative amount', () => {
    renderDetail(<BankTransactionDetail txn={mockExpenseTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.queryByLabelText('Payment Type')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark Reconciled')).not.toBeInTheDocument();
  });

  test('fetches expense categories on mount for negative-amount PENDING', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{ gl_code: '6000', name: 'Utilities', is_active: true }],
      }),
    });
    renderDetail(<BankTransactionDetail txn={mockExpenseTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/expenses/categories'),
        expect.any(Object)
      )
    );
  });

  test('calls /api/bank/reconcile-expense on Record Expense', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ gl_code: '6000', name: 'Utilities', is_active: true }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
    });
    const onSuccess = jest.fn();
    renderDetail(<BankTransactionDetail txn={mockExpenseTxn} onClose={jest.fn()} onSuccess={onSuccess} />);

    await waitFor(() => screen.getByText('Utilities'));

    fireEvent.change(screen.getByRole('combobox', { name: /expense category/i }), {
      target: { value: '6000' },
    });
    fireEvent.click(screen.getByText('Record Expense'));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/bank/reconcile-expense'),
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(body.transaction_id).toBe(43);
    expect(body.gl_code).toBe('6000');
  });

  test('Record Expense button is disabled when no category selected', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    renderDetail(<BankTransactionDetail txn={mockExpenseTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByText('Record Expense')).toBeDisabled();
  });

  test('shows error message when Record Expense fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ gl_code: '6000', name: 'Utilities', is_active: true }] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Server error' }),
      });
    renderDetail(<BankTransactionDetail txn={mockExpenseTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    await waitFor(() => screen.getByText('Utilities'));
    fireEvent.change(screen.getByRole('combobox', { name: /expense category/i }), {
      target: { value: '6000' },
    });
    fireEvent.click(screen.getByText('Record Expense'));
    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
  });
});

describe('BankTransactionDetail — Zelle suggestion pre-fill and approval', () => {
  const zelleSuggestedTxn: BankTransaction = {
    ...mockTxn,
    type: 'ZELLE',
    status: 'PENDING',
    amount: 75,
    payer_name: 'SYNTHETIC PAYER',
    suggested_match: {
      type: 'LEARNED_ZELLE',
      source: 'LEARNED_ZELLE',
      confidence: 'high',
      reason: 'Previously associated with this ZELLE payer',
      member: { id: 7, first_name: 'Test', last_name: 'Member' },
    },
  };

  test('pre-selects the suggested member on a Zelle row', async () => {
    renderDetail(<BankTransactionDetail txn={zelleSuggestedTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);

    // selectedMember is seeded from the suggestion, so the "Selected Member"
    // panel renders immediately without the treasurer clicking or searching.
    expect(await screen.findByText('Selected Member')).toBeInTheDocument();
    const selectedPanel = screen.getByText('Selected Member').closest('div') as HTMLElement;
    expect(within(selectedPanel).getByText('Test Member')).toBeInTheDocument();

    // Ground truth: submitting immediately reconciles member id 7 without
    // any further interaction, proving the selection is real, not decorative.
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });
    fireEvent.click(screen.getByRole('button', { name: /Approve/i }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.member_id).toBe(7);
  });

  test('does not clobber a manual selection already made by the treasurer', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { results: [{ id: 99, name: 'Manual Member', phoneNumber: '+15551234567' }] } }),
    });

    const { rerender } = renderDetail(
      <BankTransactionDetail txn={zelleSuggestedTxn} onClose={jest.fn()} onSuccess={jest.fn()} />
    );

    // Seeded from the suggestion first.
    await screen.findByText('Selected Member');
    expect(within(screen.getByText('Selected Member').closest('div') as HTMLElement).getByText('Test Member')).toBeInTheDocument();

    // Treasurer overrides it by hand via the search box.
    fireEvent.change(screen.getByPlaceholderText(/search member/i), { target: { value: 'Manual Mem' } });
    await waitFor(() => expect(screen.getByText('Manual Member')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Manual Member'));
    expect(within(screen.getByText('Selected Member').closest('div') as HTMLElement).getByText('Manual Member')).toBeInTheDocument();

    // Parent re-renders with a fresh suggested_match object (e.g. a background
    // refresh of the same row) — the seeding effect must not stomp the treasurer's
    // manual choice just because the object identity changed.
    const sameRowRefreshed: BankTransaction = {
      ...zelleSuggestedTxn,
      suggested_match: { ...zelleSuggestedTxn.suggested_match! },
    };
    rerender(
      <I18nProvider>
        <LanguageProvider>
          <BankTransactionDetail txn={sameRowRefreshed} onClose={jest.fn()} onSuccess={jest.fn()} />
        </LanguageProvider>
      </I18nProvider>
    );

    expect(within(screen.getByText('Selected Member').closest('div') as HTMLElement).getByText('Manual Member')).toBeInTheDocument();
  });

  test('shows the suggestion provenance so the treasurer can judge it', async () => {
    renderDetail(<BankTransactionDetail txn={zelleSuggestedTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);

    expect(await screen.findByText(/Previously associated with this ZELLE payer/)).toBeInTheDocument();
    expect(screen.getByText(/high/i)).toBeInTheDocument();
  });

  test('labels the action as approval for a Zelle row', async () => {
    renderDetail(<BankTransactionDetail txn={zelleSuggestedTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(await screen.findByRole('button', { name: /^Approve$/i })).toBeInTheDocument();
  });

  test('keeps the original label for a non-Zelle PENDING income row', () => {
    const achTxn: BankTransaction = { ...mockTxn, type: 'ACH' };
    renderDetail(<BankTransactionDetail txn={achTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('Confirm Selected Member')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Approve$/i })).not.toBeInTheDocument();
  });
});
