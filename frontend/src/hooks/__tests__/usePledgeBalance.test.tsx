import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { usePledgeBalance } from '../usePledgeBalance';

const mockFetchBalance = jest.fn();
jest.mock('../../utils/pledgeBalanceApi', () => ({
  fetchPledgeBalance: (id?: number) => mockFetchBalance(id)
}));

const Probe: React.FC = () => {
  const { balance, loading, error } = usePledgeBalance();
  if (loading) return <div>loading</div>;
  if (error) return <div>error</div>;
  return <div>balance:{balance ? balance.remaining_amount : 'none'}</div>;
};

beforeEach(() => { jest.clearAllMocks(); });

describe('usePledgeBalance', () => {
  it('exposes the remaining balance', async () => {
    mockFetchBalance.mockResolvedValue({
      id: 1, campaign_id: 2, campaign_name: 'Live Drive',
      pledged_amount: 500, paid_amount: 200, remaining_amount: 300
    });

    render(<Probe />);
    expect(await screen.findByText('balance:300')).toBeInTheDocument();
  });

  it('reports none when the member has no pledge', async () => {
    mockFetchBalance.mockResolvedValue(null);

    render(<Probe />);
    expect(await screen.findByText('balance:none')).toBeInTheDocument();
  });

  it('fails quietly so a payment page never breaks', async () => {
    mockFetchBalance.mockRejectedValue(new Error('offline'));

    render(<Probe />);
    await waitFor(() => expect(screen.getByText('error')).toBeInTheDocument());
  });
});
