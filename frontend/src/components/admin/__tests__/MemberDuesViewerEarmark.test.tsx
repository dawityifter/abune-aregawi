import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MemberDuesViewer from '../MemberDuesViewer';

// A payment can be received in one year and pay another year's dues. The
// ledger lists by payment date, Paid To Date credits by for_year, so the two
// legitimately disagree — and until now nothing on the screen said so, which
// read as money gone missing. All fixtures are synthetic.

const STRINGS: Record<string, string> = {
  'memberDues.appliedToYear': 'for {year}',
  'memberDues.earmarkedNote': "{amount} received in {year} pays an earlier year's dues — see the ledger below.",
  'memberDues.paidToDate': 'Paid To Date'
};

jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, any>) => {
      let out = STRINGS[key] ?? key;
      Object.entries(params || {}).forEach(([k, v]) => { out = out.replace(`{${k}}`, String(v)); });
      return out;
    }
  })
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    firebaseUser: { getIdToken: () => Promise.resolve('mock-token') },
    currentUser: { roles: ['treasurer'] }
  })
}));

const YEAR = new Date().getFullYear();

const duesPayload = (transactions: any[], duesCollected = 0) => ({
  success: true,
  data: {
    member: { id: 1, firstName: 'Testmember', lastName: 'Example', email: '', phoneNumber: '' },
    household: {
      isHouseholdView: false,
      headOfHousehold: { id: 1, firstName: 'Testmember', lastName: 'Example' },
      memberNames: '', totalMembers: 1
    },
    payment: {
      year: YEAR,
      annualPledge: 1200,
      monthlyPayment: 100,
      duesCollected,
      outstandingDues: 1200 - duesCollected,
      duesProgress: 0,
      monthStatuses: [],
      otherContributions: { donation: 0, pledge_payment: 0, tithe: 0, offering: 0, other: 0 },
      totalOtherContributions: 0,
      grandTotal: 1000
    },
    transactions
  }
});

const renderViewer = () => render(
  <MemberDuesViewer memberId="1" onClose={jest.fn()} embedded />
);

const earmarkedRow = {
  id: 1,
  payment_date: `${YEAR}-09-08`,
  amount: 1000,
  payment_type: 'membership_due',
  payment_method: 'cash',
  receipt_number: '5001',
  note: '',
  paid_by: 'Testmember',
  for_year: YEAR - 1
};

const mockFetchWith = (payload: any) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(payload)
  }) as any;
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('MemberDuesViewer — payments earmarked to another year', () => {
  it('marks the ledger row with the year it actually pays', async () => {
    mockFetchWith(duesPayload([earmarkedRow]));

    renderViewer();

    expect(await screen.findByText(`for ${YEAR - 1}`)).toBeInTheDocument();
  });

  it('explains the gap beneath Paid To Date', async () => {
    mockFetchWith(duesPayload([earmarkedRow]));

    renderViewer();

    expect(
      await screen.findByText(new RegExp(`\\$1,000 received in ${YEAR} pays an earlier year`))
    ).toBeInTheDocument();
  });

  it('says nothing when every payment pays the year on screen', async () => {
    mockFetchWith(duesPayload([{ ...earmarkedRow, for_year: YEAR }], 1000));

    renderViewer();

    await waitFor(() => expect(screen.getByText('Paid To Date')).toBeInTheDocument());
    expect(screen.queryByText(`for ${YEAR}`)).not.toBeInTheDocument();
    expect(screen.queryByText(/pays an earlier year/)).not.toBeInTheDocument();
  });

  it('says nothing for a payment with no earmark at all', async () => {
    mockFetchWith(duesPayload([{ ...earmarkedRow, for_year: null }], 1000));

    renderViewer();

    await waitFor(() => expect(screen.getByText('Paid To Date')).toBeInTheDocument());
    expect(screen.queryByText(/pays an earlier year/)).not.toBeInTheDocument();
  });

  it('ignores an earmark on a non-dues payment', async () => {
    // for_year only governs membership dues; a donation carrying one must not
    // produce a note about dues.
    mockFetchWith(duesPayload([{ ...earmarkedRow, payment_type: 'donation' }], 0));

    renderViewer();

    await waitFor(() => expect(screen.getByText('Paid To Date')).toBeInTheDocument());
    expect(screen.queryByText(/pays an earlier year/)).not.toBeInTheDocument();
  });
});
