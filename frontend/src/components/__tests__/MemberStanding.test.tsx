import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import MemberStanding from '../MemberStanding';
import type { MemberDuesSummary } from '../../hooks/useMemberDues';

const mockUseMemberDues = jest.fn();
jest.mock('../../hooks/useMemberDues', () => ({
  useMemberDues: (year: number) => mockUseMemberDues(year)
}));

const YEAR = new Date().getFullYear();

const summary = (overrides: Partial<MemberDuesSummary> = {}): MemberDuesSummary => ({
  year: YEAR,
  totalAmountDue: 1200,
  duesCollected: 1200,
  outstandingDues: 0,
  totalGiven: 1200,
  ...overrides
});

const renderStanding = () => render(
  <BrowserRouter><I18nProvider><MemberStanding firstName="Testmember" /></I18nProvider></BrowserRouter>
);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MemberStanding', () => {
  // "Given in {year}" used to read the dues-only figure, so a member who gave
  // generously outside their membership dues saw none of it counted.
  it('counts donations, not just membership dues, under "Given"', () => {
    mockUseMemberDues.mockReturnValue({
      dues: summary({ duesCollected: 600, totalGiven: 950 }),
      loading: false
    });

    renderStanding();

    expect(screen.getByText('$950')).toBeInTheDocument();
    expect(screen.queryByText('$600')).not.toBeInTheDocument();
  });

  it('shows what is outstanding when dues are not settled', () => {
    mockUseMemberDues.mockReturnValue({
      dues: summary({ outstandingDues: 300, duesCollected: 900, totalGiven: 900 }),
      loading: false
    });

    renderStanding();

    expect(screen.getByText(/\$300/)).toBeInTheDocument();
  });

  it('fails closed when the dues lookup returned nothing', () => {
    mockUseMemberDues.mockReturnValue({ dues: null, loading: false });

    renderStanding();

    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
});
