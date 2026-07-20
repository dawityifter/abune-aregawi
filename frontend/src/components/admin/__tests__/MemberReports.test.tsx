import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import MemberReports from '../MemberReports';

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: async () => 'test-token' } })
}));
jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key })
}));

const householdPayload = {
  success: true,
  data: {
    reportType: 'household_directory',
    generatedAt: '2026-07-18T19:45:00.000Z',
    generatedBy: 'Admin User',
    summary: {
      totalHouseholds: 2,
      totalParishMembers: 5,
      totalHeads: 2,
      totalSpouses: 1,
      totalDependents: 1
    },
    households: [{
      headId: 7,
      householdName: 'Abraham & Hana Tesfaye Household',
      head: { name: 'Abraham Tesfaye', phone: '+19725551234' },
      spouse: { name: 'Hana Tesfaye', phone: null },
      dependents: [
        { name: 'Samuel Tesfaye', relationship: 'Son', phone: null, age: 16 },
        { name: 'Ruth Tesfaye', relationship: 'Daughter', phone: null, age: null }
      ],
      otherFamilyMembers: [{ name: 'Noah Yifter', phone: null, age: 16 }]
    }, {
      // No dependent rows at all — only a linked member. The Dependents
      // section header must still render (folded-in otherFamilyMembers).
      headId: 8,
      householdName: 'Yonas Gebre Household',
      head: { name: 'Yonas Gebre', phone: null },
      spouse: null,
      dependents: [],
      otherFamilyMembers: [{ name: 'Dawit Gebre', phone: null, age: 20 }]
    }]
  }
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => householdPayload
  }) as jest.Mock;
});

test('renders household directory with summary and hides missing phones', async () => {
  render(<MemberReports />);

  await waitFor(() =>
    expect(screen.getByText('Abraham & Hana Tesfaye Household')).toBeInTheDocument()
  );

  // Summary values (appears at top and bottom of the report)
  expect(screen.getAllByText('householdReport.summaryTitle').length).toBeGreaterThanOrEqual(2);
  // Head phone is shown, formatted
  expect(screen.getByText(/\(972\) 555-1234/)).toBeInTheDocument();
  // Spouse has no phone: exactly one Mobile line in the household block
  expect(screen.getAllByText(/householdReport\.mobile/)).toHaveLength(1);
  // Dependent with relationship + age -> "(Son, 16)"
  expect(screen.getByText(/Samuel Tesfaye/)).toBeInTheDocument();
  expect(screen.getByText(/\(Son, 16\)/)).toBeInTheDocument();
  // Dependent with relationship only, no DOB on file -> "(Daughter)"
  expect(screen.getByText(/Ruth Tesfaye/)).toBeInTheDocument();
  expect(screen.getByText(/\(Daughter\)/)).toBeInTheDocument();
  // Linked household member (age only, no relationship) renders under the
  // Dependents section as "(16)" — the separate "Household Members" section is gone
  expect(screen.getByText(/Noah Yifter/)).toBeInTheDocument();
  expect(screen.getByText(/\(16\)/)).toBeInTheDocument();
  expect(screen.queryByText('householdReport.householdMembers')).not.toBeInTheDocument();

  // Household with no dependent rows, only a linked member: the Dependents
  // section header still renders (not skipped just because there are no
  // dependent rows), and the linked member's age-only detail shows as "(20)".
  expect(screen.getByText('Yonas Gebre Household')).toBeInTheDocument();
  expect(screen.getByText(/Dawit Gebre/)).toBeInTheDocument();
  expect(screen.getByText(/\(20\)/)).toBeInTheDocument();
  expect(screen.getAllByText('householdReport.dependentsSection')).toHaveLength(2);
});

test('fetches with sort_by=last_name by default and refetches with sort_by=first_name on change', async () => {
  render(<MemberReports />);

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  const firstCallUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
  expect(firstCallUrl).toContain('/api/members/reports/household-directory');
  expect(firstCallUrl).toContain('sort_by=last_name');

  fireEvent.change(screen.getByLabelText('householdReport.sortBy'), { target: { value: 'first_name' } });

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  const secondCallUrl = (global.fetch as jest.Mock).mock.calls[1][0] as string;
  expect(secondCallUrl).toContain('sort_by=first_name');

  // Toggling away to Member Information and back to Household Directory,
  // with sortBy unchanged, must reuse the cached data — no extra fetch.
  fireEvent.change(screen.getByLabelText('memberReports.selectLabel'), { target: { value: 'member_information' } });
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));

  fireEvent.change(screen.getByLabelText('memberReports.selectLabel'), { target: { value: 'household_directory' } });
  expect(global.fetch).toHaveBeenCalledTimes(3);
});
