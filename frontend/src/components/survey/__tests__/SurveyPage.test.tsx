import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import SurveyPage from '../SurveyPage';
import * as surveyApi from '../../../utils/surveyApi';
import * as surveyDraft from '../../../utils/surveyDraft';

jest.mock('../../../utils/surveyApi');
const mockedSubmit = surveyApi.submitSurveyResponse as jest.Mock;

const renderPage = () => render(<I18nProvider><LanguageProvider><SurveyPage /></LanguageProvider></I18nProvider>);

describe('SurveyPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockedSubmit.mockReset();
    mockedSubmit.mockResolvedValue(undefined);
  });

  it('starts on section 1 of 11 and shows a Next but no Back button', () => {
    renderPage();
    expect(screen.getByText('Section 1 of 11')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('advances to section 2 on Next and can go Back to section 1', () => {
    renderPage();
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Section 2 of 11')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Section 1 of 11')).toBeInTheDocument();
  });

  it('persists answers to localStorage as the user progresses', () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Male'));
    const saved = JSON.parse(window.localStorage.getItem('survey.church-services-assessment-2026.draft') as string);
    expect(saved.answers.q2).toBe('male');
  });

  it('restores a saved draft on mount', () => {
    surveyDraft.saveDraft({ answers: { q2: 'female' }, otherTexts: {}, sectionIndex: 1 });
    renderPage();
    expect(screen.getByText('Section 2 of 11')).toBeInTheDocument();
  });

  it('persists the picked member status and restores it after a reload past section 1', async () => {
    const { unmount } = renderPage();
    fireEvent.click(screen.getByLabelText('New Member'));

    const saved = JSON.parse(window.localStorage.getItem('survey.church-services-assessment-2026.draft') as string);
    expect(saved.memberStatus).toBe('newMember');

    // Advance past section 1 (where the member-status radio lives) and remount,
    // simulating a reload: the restored draft must still carry memberStatus.
    fireEvent.click(screen.getByText('Next'));
    unmount();
    renderPage();
    expect(screen.getByText('Section 2 of 11')).toBeInTheDocument();
    expect(screen.queryByLabelText('New Member')).not.toBeInTheDocument();

    // Jump to the last section and submit to prove the restored value is sent.
    for (let i = 0; i < 9; i++) fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Submit'));
    await waitFor(() => expect(mockedSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ memberStatus: 'newMember' })
    ));
  });

  it('shows Submit instead of Next on the last section, and shows the thank-you screen after a successful submit', async () => {
    surveyDraft.saveDraft({ answers: { q1: 'age18to28' }, otherTexts: {}, sectionIndex: 10 });
    renderPage();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => expect(screen.getByText('Thank You')).toBeInTheDocument());
    expect(mockedSubmit).toHaveBeenCalledWith(expect.objectContaining({
      surveySlug: 'church-services-assessment-2026',
      locale: 'en',
      answers: expect.objectContaining({ q1: 'age18to28' })
    }));
    expect(window.localStorage.getItem('survey.church-services-assessment-2026.draft')).toBeNull();
  });

  it('shows an error message and stays on the wizard if submit fails', async () => {
    mockedSubmit.mockRejectedValue(new Error('network error'));
    surveyDraft.saveDraft({ answers: {}, otherTexts: {}, sectionIndex: 10 });
    renderPage();
    fireEvent.click(screen.getByText('Submit'));
    await waitFor(() => expect(screen.getByText('Something went wrong submitting your response. Please try again.')).toBeInTheDocument());
  });

  it("only includes a question's Other free text when its Other option is actually selected", () => {
    surveyDraft.saveDraft({ answers: { q4: ['other'] }, otherTexts: { q4Other: 'A friend from work' }, sectionIndex: 10 });
    renderPage();
    fireEvent.click(screen.getByText('Submit'));
    expect(mockedSubmit).toHaveBeenCalledWith(expect.objectContaining({
      answers: expect.objectContaining({ q4Other: 'A friend from work' })
    }));
  });
});
