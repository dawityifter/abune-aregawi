import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { LanguageProvider } from '../../contexts/LanguageContext';
import ThankYouPage from '../ThankYouPage';

const mockUseActiveCampaign = jest.fn();
jest.mock('../../hooks/useActiveCampaign', () => ({
  useActiveCampaign: () => mockUseActiveCampaign()
}));

// Capture the props the tracker is handed rather than rendering the real one.
const mockTrackerProps = jest.fn();
jest.mock('../../components/PledgeTracker', () => (props: any) => {
  mockTrackerProps(props);
  return <div>tracker</div>;
});

const CAMPAIGN = {
  id: 7, slug: 'test-drive', name: 'Test Drive', name_ti: null,
  description: null, description_ti: null,
  start_date: '2026-01-01', end_date: '2026-12-31',
  goal_amount: '50000.00', currency: 'usd'
};

// The page reads t() now, so it must render inside the providers.
const renderPage = () => render(
  <MemoryRouter><I18nProvider><LanguageProvider><ThankYouPage /></LanguageProvider></I18nProvider></MemoryRouter>
);

beforeEach(() => { jest.clearAllMocks(); });

describe('ThankYouPage', () => {
  it('scopes the tracker to the live campaign', () => {
    mockUseActiveCampaign.mockReturnValue({ campaign: CAMPAIGN, loading: false, error: null });

    renderPage();

    // Without campaignId the tracker totals every pledge ever recorded,
    // including the closed historical drive.
    expect(mockTrackerProps).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: 7, goalAmount: 50000 })
    );
  });

  it('omits the tracker entirely when no drive is running', () => {
    mockUseActiveCampaign.mockReturnValue({ campaign: null, loading: false, error: null });

    renderPage();

    expect(screen.queryByText('tracker')).not.toBeInTheDocument();
  });

  it('does not promise a confirmation text that is never sent', () => {
    // The pledge path sends no SMS at all. The same promise was stripped off
    // the pledge page under spec D6 and survived here, where a giver reads it
    // immediately after giving and then waits for a message that never comes.
    mockUseActiveCampaign.mockReturnValue({ campaign: CAMPAIGN, loading: false, error: null });

    renderPage();

    expect(screen.queryByText(/confirmation text message/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/payment instructions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Check Your Text Message/i)).not.toBeInTheDocument();
  });
});

describe('ThankYouPage in Tigrigna', () => {
  beforeEach(() => {
    localStorage.setItem('app.lang', 'ti');
    mockUseActiveCampaign.mockReturnValue({ campaign: CAMPAIGN, loading: false, error: null });
  });

  afterEach(() => localStorage.removeItem('app.lang'));

  it('leaves no English anywhere on the page', () => {
    renderPage();

    const english = [
      'Thank You!',
      'Your pledge has been received and recorded',
      "What's Next?",
      'Choose Your Payment Method',
      "Pay when you're ready using credit card, bank transfer, cash, Zelle, or other preferred methods.",
      'Track Your Impact',
      "Witness how your generous contribution helps expand God's house for our growing congregation.",
      'Questions?',
      'Return to Home',
      'Make Additional Donation',
      'Annual Fundraising Progress',
      'Track our progress for the Abune Aregawi church yearly fundraising event.',
      'Share Your Support',
      'Help us spread the word about this important cause.',
      'Share on Facebook',
      'Share on Twitter',
      'Your Pledge Makes a Difference',
      'God Bless You'
    ];

    for (const phrase of english) {
      expect(screen.queryByText(phrase)).not.toBeInTheDocument();
    }
  });

  it('still shows the church address and email unchanged', () => {
    // Contact details are not translatable content.
    renderPage();

    expect(screen.getByText(/abunearegawitx@gmail\.com/)).toBeInTheDocument();
    expect(screen.getByText(/1621 S Jupiter Rd/)).toBeInTheDocument();
  });
});
