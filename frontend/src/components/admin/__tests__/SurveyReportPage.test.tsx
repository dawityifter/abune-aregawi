import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
      questionTallies: { q2: { male: 1, female: 1 } },
      freeTextAnswers: { q7: ['Great parish'] }
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Total Responses')).toBeInTheDocument());
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Great parish')).toBeInTheDocument();
    expect(mockedFetchReport).toHaveBeenCalledWith('token', 'church-services-assessment-2026');
  });
});
