import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider, useLanguage } from '../../../contexts/LanguageContext';
import SurveyPage from '../SurveyPage';
import * as surveyApi from '../../../utils/surveyApi';
import * as surveyDraft from '../../../utils/surveyDraft';

jest.mock('../../../utils/surveyApi');
const mockedSubmit = surveyApi.submitSurveyResponse as jest.Mock;

const DRAFT_KEY = 'survey.church-services-assessment-2026.draft';
const readDraft = () => JSON.parse(window.localStorage.getItem(DRAFT_KEY) as string);

const renderPage = () => render(<I18nProvider><LanguageProvider><SurveyPage /></LanguageProvider></I18nProvider>);

// Exercises the real provider rather than a mocked one, so the test proves what
// an actual language switch does to in-progress answers.
const LanguageToggle: React.FC = () => {
  const { setLanguage } = useLanguage();
  return <button onClick={() => setLanguage('ti')}>switch-to-tigrigna</button>;
};

const renderPageWithLanguageToggle = () => render(
  <I18nProvider><LanguageProvider><LanguageToggle /><SurveyPage /></LanguageProvider></I18nProvider>
);

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

  it("shows the server's own reason and stays on the wizard if submit fails", async () => {
    mockedSubmit.mockRejectedValue(new Error('Too many survey submissions from this IP, please try again later.'));
    surveyDraft.saveDraft({ answers: {}, otherTexts: {}, sectionIndex: 10 });
    renderPage();
    fireEvent.click(screen.getByText('Submit'));
    await waitFor(() => expect(
      screen.getByText('Too many survey submissions from this IP, please try again later.')
    ).toBeInTheDocument());
    expect(screen.getByText('Section 11 of 11')).toBeInTheDocument();
  });

  it('falls back to the generic error message when the failure carries no message', async () => {
    mockedSubmit.mockRejectedValue(new Error(''));
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

  it('tells the respondent their answers are kept, so 56 questions do not have to be done in one sitting', () => {
    renderPage();
    expect(screen.getByText('Your answers are saved on this device. You can close this page and finish later.')).toBeInTheDocument();
  });

  describe('returning to a saved draft', () => {
    // Midday UTC so the rendered date is the same calendar day across the
    // timezones this suite might run in.
    const SAVED_AT = Date.UTC(2026, 7, 17, 12, 0, 0);

    const writeDraft = (draft: Record<string, unknown>) =>
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ otherTexts: {}, savedAt: SAVED_AT, ...draft }));

    // The save effect fires on the first commit with the component's initial
    // (empty) state, before the restore effect's state lands — so it writes an
    // empty draft over the real one. In production the next commit overwrites
    // that with the restored values, but under StrictMode's double-invoke the
    // restore effect re-reads storage in between and restores the blank.
    it('does not blank the restored draft when effects run twice, as they do under StrictMode', () => {
      writeDraft({ answers: { q2: 'male' }, sectionIndex: 3, memberStatus: 'newMember' });
      render(
        <React.StrictMode>
          <I18nProvider><LanguageProvider><SurveyPage /></LanguageProvider></I18nProvider>
        </React.StrictMode>
      );
      expect(screen.getByText('Section 4 of 11')).toBeInTheDocument();
      expect(readDraft().answers).toEqual({ q2: 'male' });
      expect(readDraft().memberStatus).toBe('newMember');
    });

    it('welcomes the respondent back and names the day their progress was saved', () => {
      writeDraft({ answers: { q2: 'male' }, sectionIndex: 3 });
      renderPage();
      expect(screen.getByText('Welcome back — we saved your progress from Aug 17, 2026.')).toBeInTheDocument();
    });

    it('welcomes back without a date when the draft predates saved-at stamping', () => {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers: { q2: 'male' }, otherTexts: {}, sectionIndex: 3 }));
      renderPage();
      expect(screen.getByText('Welcome back — we saved your progress.')).toBeInTheDocument();
    });

    it('says nothing on a first visit', () => {
      renderPage();
      expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
    });

    it('says nothing when the draft holds no progress worth resuming', () => {
      writeDraft({ answers: {}, sectionIndex: 0 });
      renderPage();
      expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
    });

    it('welcomes back a draft whose only progress is the member status', () => {
      writeDraft({ answers: {}, sectionIndex: 0, memberStatus: 'newMember' });
      renderPage();
      expect(screen.getByText(/Welcome back/)).toBeInTheDocument();
    });

    it('dismissing the banner hides it without touching the restored answers', () => {
      writeDraft({ answers: { q2: 'male' }, sectionIndex: 0 });
      renderPage();
      fireEvent.click(screen.getByLabelText('Dismiss'));
      expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
      expect(screen.getByLabelText('Male')).toBeChecked();
    });

    it('asks for a second tap before erasing answers, since one tap can destroy a half-finished survey', () => {
      writeDraft({ answers: { q2: 'male' }, sectionIndex: 0 });
      renderPage();
      fireEvent.click(screen.getByText('Start over'));
      expect(screen.getByText('Yes, erase my answers')).toBeInTheDocument();
      expect(screen.getByLabelText('Male')).toBeChecked();
    });

    it('erases the answers, the stored draft, and the section on the confirming tap', () => {
      writeDraft({ answers: { q2: 'male' }, sectionIndex: 3, memberStatus: 'newMember' });
      renderPage();
      fireEvent.click(screen.getByText('Start over'));
      fireEvent.click(screen.getByText('Yes, erase my answers'));

      expect(screen.getByText('Section 1 of 11')).toBeInTheDocument();
      expect(screen.getByLabelText('Male')).not.toBeChecked();
      expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
      const saved = readDraft();
      expect(saved.answers).toEqual({});
      expect(saved.memberStatus).toBeUndefined();
    });
  });

  it('keeps every answer when the respondent switches language mid-survey', () => {
    renderPageWithLanguageToggle();
    fireEvent.click(screen.getByLabelText('Male'));

    fireEvent.click(screen.getByText('switch-to-tigrigna'));

    // Answers are keyed by option key, never by the displayed label, so the
    // same answer simply re-renders in the other language.
    expect(screen.getByLabelText('ተባዕታይ')).toBeChecked();
    expect(readDraft().answers.q2).toBe('male');
  });
});
