import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BankTransactionDetail from '../BankTransactionDetail';
import { BankTransaction } from '../BankTransactionList';

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

global.fetch = jest.fn();

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
    const { container } = render(
      <BankTransactionDetail txn={null} onClose={jest.fn()} onSuccess={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('renders panel when txn is provided', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Transaction Details' })).toBeInTheDocument();
  });

  test('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn();
    render(<BankTransactionDetail txn={mockTxn} onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.click(screen.getByTestId('panel-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  test('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<BankTransactionDetail txn={mockTxn} onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Close panel'));
    expect(onClose).toHaveBeenCalled();
  });

  test('calls onClose when Escape key is pressed', () => {
    const onClose = jest.fn();
    render(<BankTransactionDetail txn={mockTxn} onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('BankTransactionDetail — field display', () => {
  test('shows transaction id in header', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('#42')).toBeInTheDocument();
  });

  test('shows PENDING status badge', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('PENDING REVIEW')).toBeInTheDocument();
  });

  test('shows full description without truncation', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('ZELLE FROM DAWIT YIFTER ON 03/28 REF#ABC123')).toBeInTheDocument();
  });

  test('shows type badge', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('ZELLE')).toBeInTheDocument();
  });

  test('shows payer name', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('Dawit Yifter')).toBeInTheDocument();
  });

  test('shows formatted amount', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('$200.00')).toBeInTheDocument();
  });

  test('does not show check number when null', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.queryByText(/Check #/)).not.toBeInTheDocument();
  });

  test('shows check number when present', () => {
    const txnWithCheck = { ...mockTxn, check_number: '1042' };
    render(<BankTransactionDetail txn={txnWithCheck} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('Check #1042')).toBeInTheDocument();
  });

  test('shows MATCHED status badge for matched transaction', () => {
    const matched = {
      ...mockTxn,
      payer_name: 'Bank Payer Name',  // different from member name
      status: 'MATCHED' as const,
      member: { first_name: 'Dawit', last_name: 'Yifter' },
    };
    render(<BankTransactionDetail txn={matched} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('MATCHED')).toBeInTheDocument();
    expect(screen.getByText('Dawit Yifter')).toBeInTheDocument();
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
    render(<BankTransactionDetail txn={mockTxnWithMatch} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('Suggested Match Found')).toBeInTheDocument();
    expect(screen.getByText('Confirm Match')).toBeInTheDocument();
  });

  test('shows payment type selector for PENDING income', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByLabelText('Payment Type')).toBeInTheDocument();
  });

  test('year selector hidden when payment type is not membership_due', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.queryByLabelText('Year (Optional)')).not.toBeInTheDocument();
  });

  test('year selector appears when membership_due is selected', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Payment Type'), { target: { value: 'membership_due' } });
    expect(screen.getByLabelText('Year (Optional)')).toBeInTheDocument();
  });

  test('calls /api/bank/reconcile with MATCH action on Confirm Match', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    const onSuccess = jest.fn();
    render(<BankTransactionDetail txn={mockTxnWithMatch} onClose={jest.fn()} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText('Confirm Match'));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/bank/reconcile'),
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.action).toBe('MATCH');
    expect(body.transaction_id).toBe(42);
    expect(body.member_id).toBe(5);
  });

  test('shows member search input', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByPlaceholderText(/search member/i)).toBeInTheDocument();
  });

  test('shows Ignore Transaction button for PENDING income', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('Ignore Transaction')).toBeInTheDocument();
  });

  test('calls /api/bank/reconcile with IGNORE action on Ignore', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    const onSuccess = jest.fn();
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText('Ignore Transaction'));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.action).toBe('IGNORE');
    expect(body.transaction_id).toBe(42);
  });
});
