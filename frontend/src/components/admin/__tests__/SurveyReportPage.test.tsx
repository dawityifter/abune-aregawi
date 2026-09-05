import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import SurveyReportPage from '../SurveyReportPage';
import * as surveyApi from '../../../utils/surveyApi';

jest.mock('../../../utils/surveyApi');
const mockedFetchReport = surveyApi.fetchSurveyReport as jest.Mock;

const mockUseAuth = jest.fn();
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

const renderPage = () => render(<I18nProvider><LanguageProvider><SurveyReportPage /></LanguageProvider></I18nProvider>);

describe('SurveyReportPage', () => {
  beforeEach(() => {
    mockedFetchReport.mockReset();
  });

  it('shows access denied for a member role', async () => {
    mockUseAuth.mockReturnValue({
      currentUser: { uid: '1' },
      firebaseUser: { getIdToken: async () => 'token' },
      getUserProfile: async () => ({ data: { member: { roles: ['member'] } } })
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('You do not have permission to view this page.')).toBeInTheDocument());
    expect(mockedFetchReport).not.toHaveBeenCalled();
  });

  it('reports a load error instead of spinning forever when the profile fetch fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => { });
    mockUseAuth.mockReturnValue({
      currentUser: { uid: '1' },
      firebaseUser: { getIdToken: async () => 'token' },
      getUserProfile: async () => { throw new Error('network blip'); }
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load the survey report.')).toBeInTheDocument());
    expect(screen.queryByText('Loading report...')).not.toBeInTheDocument();
    expect(mockedFetchReport).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('grants access to the church_leadership role (this system has no "board" role)', async () => {
    mockUseAuth.mockReturnValue({
      currentUser: { uid: '1' },
      firebaseUser: { getIdToken: async () => 'token' },
      getUserProfile: async () => ({ data: { member: { roles: ['church_leadership'] } } })
    });
    mockedFetchReport.mockResolvedValue({
      totalResponses: 1,
      questionTallies: { q2: { male: 1 } },
      freeTextAnswers: {}
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Total Responses')).toBeInTheDocument());
    expect(mockedFetchReport).toHaveBeenCalled();
  });

  it('loads and displays tallies for an admin role', async () => {
    mockUseAuth.mockReturnValue({
      currentUser: { uid: '1' },
      firebaseUser: { getIdToken: async () => 'token' },
      getUserProfile: async () => ({ data: { member: { roles: ['admin'] } } })
    });
    mockedFetchReport.mockResolvedValue({
      totalResponses: 2,
      answeredCounts: { q2: 2 },
      questionTallies: { q2: { male: 1, female: 1 } },
      freeTextAnswers: { q7: ['Great parish'] }
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Total Responses')).toBeInTheDocument());
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Great parish')).toBeInTheDocument();
    expect(mockedFetchReport).toHaveBeenCalledWith('token', 'church-services-assessment-2026');
  });

  it('shows the member-status and locale breakdowns above the per-question tallies', async () => {
    mockUseAuth.mockReturnValue({
      currentUser: { uid: '1' },
      firebaseUser: { getIdToken: async () => 'token' },
      getUserProfile: async () => ({ data: { member: { roles: ['admin'] } } })
    });
    // 10 responses; only 8 gave a member status, so member-status percentages are
    // out of 8 while locale percentages are out of all 10.
    mockedFetchReport.mockResolvedValue({
      totalResponses: 10,
      answeredCounts: { q2: 10 },
      memberStatusTallies: { firstTimeGuest: 2, newMember: 2, existingMember: 4 },
      localeTallies: { en: 7, ti: 3 },
      questionTallies: { q2: { male: 5, female: 5 } },
      freeTextAnswers: {}
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Member Status')).toBeInTheDocument());

    // Scoped to each breakdown block: some of these labels ('First-time / Guest',
    // 'English') are also option labels on q3 and q15.
    const statusBlock = screen.getByText('Member Status').closest('div') as HTMLElement;
    expect(within(statusBlock).getByText('First-time / Guest')).toBeInTheDocument();
    expect(within(statusBlock).getByText('Existing Member')).toBeInTheDocument();
    expect(within(statusBlock).getByText('8 of 10 answered')).toBeInTheDocument();
    // 4 of the 8 who gave a status are existing members — not 40% of all 10.
    expect(within(statusBlock).getByText('4 (50%)')).toBeInTheDocument();

    const localeBlock = screen.getByText('Survey Language').closest('div') as HTMLElement;
    expect(within(localeBlock).getByText('English')).toBeInTheDocument();
    expect(within(localeBlock).getByText('Tigrigna')).toBeInTheDocument();
    expect(within(localeBlock).getByText('7 (70%)')).toBeInTheDocument();
    expect(within(localeBlock).getByText('3 (30%)')).toBeInTheDocument();

    // Both breakdowns come before the per-question tallies.
    const language = screen.getByText('Survey Language');
    const firstQuestion = screen.getByText(/What is your age group/i);
    expect(language.compareDocumentPosition(firstQuestion) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('computes percentages against the per-question answered count, not total responses', async () => {
    mockUseAuth.mockReturnValue({
      currentUser: { uid: '1' },
      firebaseUser: { getIdToken: async () => 'token' },
      getUserProfile: async () => ({ data: { member: { roles: ['admin'] } } })
    });
    // 100 responses overall, but only 4 people answered q2. male:3 of those 4 is
    // 75% — not 3% of the whole survey population.
    mockedFetchReport.mockResolvedValue({
      totalResponses: 100,
      answeredCounts: { q2: 4 },
      questionTallies: { q2: { male: 3, female: 1 } },
      freeTextAnswers: {}
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Total Responses')).toBeInTheDocument());
    expect(screen.getByText('3 (75%)')).toBeInTheDocument();
    expect(screen.getByText('1 (25%)')).toBeInTheDocument();
    // The answered count is shown so an admin can see the real base for q2.
    expect(screen.getByText('4 of 100 answered')).toBeInTheDocument();
  });
});
