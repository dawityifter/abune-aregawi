import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import SurveyQuestion from '../SurveyQuestion';
import { SurveyQuestionDef } from '../surveyDefinitions';

const renderWithProviders = (ui: React.ReactElement) =>
  render(<I18nProvider><LanguageProvider>{ui}</LanguageProvider></I18nProvider>);

describe('SurveyQuestion', () => {
  it('renders a single-select question as radio buttons and reports selection', () => {
    const q: SurveyQuestionDef = { id: 'q2', section: 1, type: 'single', optionKeys: ['male', 'female'] };
    const onChange = jest.fn();
    renderWithProviders(
      <SurveyQuestion question={q} value={undefined} otherValue={undefined} onChange={onChange} onOtherChange={jest.fn()} />
    );
    fireEvent.click(screen.getByLabelText('Male'));
    expect(onChange).toHaveBeenCalledWith('q2', 'male');
  });

  it('renders a multi-select question as checkboxes and toggles values', () => {
    const q: SurveyQuestionDef = { id: 'q2', section: 1, type: 'multi', optionKeys: ['male', 'female'] };
    const onChange = jest.fn();
    renderWithProviders(
      <SurveyQuestion question={q} value={['male']} otherValue={undefined} onChange={onChange} onOtherChange={jest.fn()} />
    );
    fireEvent.click(screen.getByLabelText('Female'));
    expect(onChange).toHaveBeenCalledWith('q2', ['male', 'female']);

    fireEvent.click(screen.getByLabelText('Male'));
    expect(onChange).toHaveBeenCalledWith('q2', []);
  });

  it('disables unchecked options once maxSelect is reached', () => {
    const q: SurveyQuestionDef = { id: 'q32', section: 6, type: 'multi', optionKeys: ['soundSystem', 'displayScreens', 'chairsSeating'], maxSelect: 2 };
    renderWithProviders(
      <SurveyQuestion question={q} value={['soundSystem', 'displayScreens']} otherValue={undefined} onChange={jest.fn()} onOtherChange={jest.fn()} />
    );
    expect(screen.getByLabelText('Chairs or seating')).toBeDisabled();
    expect(screen.getByLabelText('Sound system')).not.toBeDisabled();
  });

  it('shows a companion text field only when the otherOptionKey is selected, single-select', () => {
    const q: SurveyQuestionDef = { id: 'q15', section: 3, type: 'single', optionKeys: ['tigrinya', 'other'], otherOptionKey: 'other' };
    const onOtherChange = jest.fn();
    const { rerender } = renderWithProviders(
      <SurveyQuestion question={q} value="tigrinya" otherValue={undefined} onChange={jest.fn()} onOtherChange={onOtherChange} />
    );
    expect(screen.queryByPlaceholderText('Please specify...')).not.toBeInTheDocument();

    rerender(
      <I18nProvider><LanguageProvider>
        <SurveyQuestion question={q} value="other" otherValue={undefined} onChange={jest.fn()} onOtherChange={onOtherChange} />
      </LanguageProvider></I18nProvider>
    );
    fireEvent.change(screen.getByPlaceholderText('Please specify...'), { target: { value: 'Amharic' } });
    expect(onOtherChange).toHaveBeenCalledWith('q15', 'Amharic');
  });

  it('renders a text question as a textarea', () => {
    const q: SurveyQuestionDef = { id: 'q7', section: 1, type: 'text' };
    const onChange = jest.fn();
    renderWithProviders(
      <SurveyQuestion question={q} value={undefined} otherValue={undefined} onChange={onChange} onOtherChange={jest.fn()} />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My answer' } });
    expect(onChange).toHaveBeenCalledWith('q7', 'My answer');
  });
});
