import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AttentionPanel from '../AttentionPanel';
import { DashboardAttention } from '../../../../utils/pledgeDashboardApi';
import { I18nProvider } from '../../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../../contexts/LanguageContext';

const renderWithLanguage = (ui: React.ReactElement) =>
  render(<I18nProvider><LanguageProvider>{ui}</LanguageProvider></I18nProvider>);

const attention: DashboardAttention = {
  stalled: 12, never_started: 47, overpaid: 2, unlinked: 3, ending_soon: false
};

describe('AttentionPanel', () => {
  it('lists each non-zero count as an actionable row', () => {
    renderWithLanguage(<AttentionPanel attention={attention} onSelect={jest.fn()} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
  });

  // Nothing needing attention is good news and should read as such, not as an
  // empty list the reader has to interpret.
  it('says so plainly when nothing needs attention', () => {
    renderWithLanguage(<AttentionPanel
      attention={{ stalled: 0, never_started: 0, overpaid: 0, unlinked: 0, ending_soon: false }}
      onSelect={jest.fn()} />);
    expect(screen.getByTestId('attention-clear')).toBeInTheDocument();
  });

  it('omits a zero row rather than listing it', () => {
    renderWithLanguage(<AttentionPanel attention={{ ...attention, unlinked: 0 }} onSelect={jest.fn()} />);
    expect(screen.queryByTestId('attention-unlinked')).not.toBeInTheDocument();
  });

  // A withheld count is not the same as no problem. It must stay visible and
  // say that the figure is protected.
  it('shows a withheld count as an em dash rather than hiding the row', () => {
    renderWithLanguage(<AttentionPanel attention={{ ...attention, overpaid: null }} onSelect={jest.fn()} />);
    expect(screen.getByTestId('attention-overpaid')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('flags a drive inside its final thirty days', () => {
    renderWithLanguage(<AttentionPanel attention={{ ...attention, ending_soon: true }} onSelect={jest.fn()} />);
    expect(screen.getByTestId('attention-ending-soon')).toBeInTheDocument();
  });

  it('calls back with the filter name when a row is chosen', async () => {
    const onSelect = jest.fn();
    renderWithLanguage(<AttentionPanel attention={attention} onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId('attention-stalled'));
    expect(onSelect).toHaveBeenCalledWith('stalled');
  });
});
