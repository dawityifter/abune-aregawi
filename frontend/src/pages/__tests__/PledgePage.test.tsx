import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { LanguageProvider } from '../../contexts/LanguageContext';
import PledgePage from '../PledgePage';
import ThankYouPage from '../ThankYouPage';

const mockUseActiveCampaign = jest.fn();
jest.mock('../../hooks/useActiveCampaign', () => ({
  useActiveCampaign: () => mockUseActiveCampaign()
}));

const mockUseAuth = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuth: () => mockUseAuth()
}));

const mockUsePledgeBalance = jest.fn();
jest.mock('../../hooks/usePledgeBalance', () => ({
  usePledgeBalance: () => mockUsePledgeBalance()
}));

// The tracker fetches on mount; keep it quiet and irrelevant to these cases.
jest.mock('../../components/PledgeTracker', () => () => <div>tracker</div>);

// Stripe.js cannot run in jsdom, so the card form itself is stubbed down to a
// single button that fires the success callback. What is under test is what
// PledgePage does *after* a payment succeeds, not the payment.
jest.mock('../../components/StripePayment', () => (props: any) => (
  <button onClick={() => props.onSuccess({ id: 99, payment_intent_id: 'pi_test' })}>
    simulate successful payment
  </button>
));

const CAMPAIGN = {
  id: 7, slug: 'test-drive', name: 'Test Building Drive', name_ti: null,
  description: 'Help us finish the hall.', description_ti: null,
  start_date: '2026-01-01', end_date: '2026-12-31',
  goal_amount: '50000.00', currency: 'usd'
};

const renderPage = () => render(
  <MemoryRouter><I18nProvider><LanguageProvider><PledgePage /></LanguageProvider></I18nProvider></MemoryRouter>
);

// Navigation is the behaviour under test, so it has to be real: a bare
// MemoryRouter would swallow navigate() and let a broken redirect pass.
// Landing on the actual ThankYouPage is the only honest assertion.
const renderPageWithRoutes = () => render(
  <MemoryRouter initialEntries={['/pledge']}>
    <I18nProvider><LanguageProvider>
      <Routes>
        <Route path="/pledge" element={<PledgePage />} />
        <Route path="/thank-you" element={<ThankYouPage />} />
      </Routes>
    </LanguageProvider></I18nProvider>
  </MemoryRouter>
);

// Shared default: a signed-out visitor with no pledge balance, unless a test
// overrides it. Keeps the pre-existing tests below meaningful without forcing
// every one of them to restate the auth/balance boilerplate.
beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: null, currentUser: null });
  mockUsePledgeBalance.mockReturnValue({ balance: null, loading: false });
});

describe('PledgePage', () => {
  it('shows the pledge form while a drive is running', () => {
    mockUseActiveCampaign.mockReturnValue({ campaign: CAMPAIGN, loading: false, error: null });

    renderPage();

    expect(screen.getByText('Test Building Drive')).toBeInTheDocument();
    expect(screen.queryByText(/no fundraising drive/i)).not.toBeInTheDocument();
  });

  it('explains that no drive is running instead of showing a form', () => {
    mockUseActiveCampaign.mockReturnValue({ campaign: null, loading: false, error: null });

    renderPage();

    expect(screen.getByText(/no fundraising drive/i)).toBeInTheDocument();
    expect(screen.queryByText('Pledge Amount *')).not.toBeInTheDocument();
  });
});

describe('PledgePage intent chooser', () => {
  beforeEach(() => {
    mockUseActiveCampaign.mockReturnValue({ campaign: CAMPAIGN, loading: false, error: null });
    mockUsePledgeBalance.mockReturnValue({ balance: null, loading: false });
    mockUseAuth.mockReturnValue({ user: null, currentUser: null });
  });

  it('offers sign-in and anonymous giving to a signed-out visitor', () => {
    renderPage();

    expect(screen.getByRole('button', { name: /give anonymously now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in to pledge/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^pledge for later$/i })).not.toBeInTheDocument();
  });

  it('offers all three choices to a signed-in member with no pledge', () => {
    mockUseAuth.mockReturnValue({ user: { id: 1 }, currentUser: { id: 1 } });
    renderPage();

    expect(screen.getByRole('button', { name: /pledge for later/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pledge and pay now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /give anonymously now/i })).toBeInTheDocument();
  });

  it('offers to pay an existing pledge instead of creating a second one', () => {
    mockUseAuth.mockReturnValue({ user: { id: 1 }, currentUser: { id: 1 } });
    mockUsePledgeBalance.mockReturnValue({
      balance: { id: 3, campaign_name: 'Test Building Drive',
                 pledged_amount: 500, paid_amount: 200, remaining_amount: 300 },
      loading: false
    });

    renderPage();

    expect(screen.getByRole('button', { name: /pay now/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pledge for later/i })).not.toBeInTheDocument();
  });

  it('does not offer a second pledge to a member who paid theirs in full', async () => {
    // The gate is EXISTENCE of an active 'later' pledge (§5.1), not an
    // outstanding balance. Keyed on `remaining_amount > 0` this member fell
    // through to the intent chooser and their next "pledge for later" hit the
    // one-active-pledge unique index — a 500 from POST /api/pledges.
    mockUseAuth.mockReturnValue({ user: { id: 1 }, currentUser: { id: 1 } });
    mockUsePledgeBalance.mockReturnValue({
      balance: { id: 3, campaign_name: 'Test Building Drive',
                 pledged_amount: 500, paid_amount: 500, remaining_amount: 0 },
      loading: false
    });

    renderPage();

    expect(screen.queryByRole('button', { name: /pledge for later/i })).not.toBeInTheDocument();
    expect(screen.getByText(/paid in full/i)).toBeInTheDocument();
    // "$0 remaining" is not a sentence anyone should have to read.
    expect(screen.queryByText(/\$0 remaining/i)).not.toBeInTheDocument();
  });

  it('does not offer a second pledge to a member who overpaid theirs', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 1 }, currentUser: { id: 1 } });
    mockUsePledgeBalance.mockReturnValue({
      balance: { id: 3, campaign_name: 'Test Building Drive',
                 pledged_amount: 500, paid_amount: 650, remaining_amount: -150 },
      loading: false
    });

    renderPage();

    expect(screen.queryByRole('button', { name: /pledge for later/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/-\$?150/)).not.toBeInTheDocument();
  });

  it('does not promise payment instructions that are never sent', async () => {
    mockUseActiveCampaign.mockReturnValue({ campaign: CAMPAIGN, loading: false, error: null });

    renderPage();

    // No such email exists and none is being built (spec D6). The card now
    // names the two ways a pledge is actually paid.
    expect(screen.queryByText(/payment instructions/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Pay when you're ready/i)).toBeInTheDocument();
  });

  it('does not promise a confirmation email that is never sent', async () => {
    // The old copy only ever lived in the post-submit success panel, so this
    // has to actually get there: sign in, pick "pledge for later", fill the
    // amount, submit, and land on the panel before asserting anything about
    // its text. Asserting on the pre-submit page (as the original version of
    // this test did) can never fail — success and its email sentence never
    // render — which defeats the point of a regression test.
    //
    // Fake timers control the success panel's `setTimeout(..., 2000)` navigate
    // call, which would otherwise fire against an already-unmounted component
    // once this test (and the real timers driving it) moves on; `waitFor`
    // still works under fake timers (it detects them and advances the fake
    // clock itself), so nothing here needs a real 2-second wait.
    jest.useFakeTimers();
    try {
      mockUseAuth.mockReturnValue({
        user: { id: 1 },
        currentUser: { id: 1, first_name: 'Test', last_name: 'Giver' },
        firebaseUser: { getIdToken: jest.fn().mockResolvedValue('test-token') }
      });
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true, pledge: { id: 42 } })
      }) as any;

      renderPage();

      // The intent card's accessible name includes its body text ("Pledge for
      // later Make a pledge now and pay it when you are ready."), so this
      // matches on the leading title only; the later submit button's
      // accessible name is the title alone, so it still matches uniquely
      // once the card is gone.
      fireEvent.click(screen.getByRole('button', { name: /^pledge for later/i }));
      fireEvent.change(screen.getByLabelText(/pledge amount/i), { target: { value: '50' } });
      fireEvent.click(screen.getByRole('button', { name: /^pledge for later$/i }));

      await waitFor(() => expect(screen.getByText('Thank You!')).toBeInTheDocument());

      expect(screen.queryByText(/confirmation email/i)).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});

// The pay-now branch (both anonymous and signed-in) set `success` but never
// scheduled the navigate that the pledge-for-later branch does, so the shared
// success panel sat forever announcing a redirect that was never coming.
describe('PledgePage pay-now redirect', () => {
  beforeEach(() => {
    mockUseActiveCampaign.mockReturnValue({ campaign: CAMPAIGN, loading: false, error: null });
    mockUsePledgeBalance.mockReturnValue({ balance: null, loading: false });
    mockUseAuth.mockReturnValue({ user: null, currentUser: null, firebaseUser: null });
  });

  const settle = async () => {
    // The success panel shows for 2s before redirecting; drive that clock
    // rather than waiting on it.
    await act(async () => { jest.advanceTimersByTime(2000); });
  };

  it('sends an anonymous giver to the thank-you page after paying', async () => {
    jest.useFakeTimers();
    try {
      renderPageWithRoutes();

      fireEvent.click(screen.getByRole('button', { name: /give anonymously now/i }));
      fireEvent.change(screen.getByLabelText(/pledge amount/i), { target: { value: '100' } });
      fireEvent.change(screen.getByLabelText(/baptism|church name/i), { target: { value: 'Tekle Haymanot' } });
      fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));
      fireEvent.click(await screen.findByRole('button', { name: /simulate successful payment/i }));

      await settle();

      // "What's Next?" is unique to ThankYouPage; both screens say "Thank You!".
      await waitFor(() => expect(screen.getByText(/What's Next\?/i)).toBeInTheDocument());
      expect(screen.queryByText(/redirecting to thank you page/i)).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('sends a signed-in member paying now to the thank-you page', async () => {
    jest.useFakeTimers();
    try {
      mockUseAuth.mockReturnValue({
        user: { id: 42, first_name: 'Signed', last_name: 'In' },
        currentUser: { id: 42 }, firebaseUser: null
      });
      renderPageWithRoutes();

      fireEvent.click(screen.getByRole('button', { name: /pledge and pay now/i }));
      fireEvent.change(screen.getByLabelText(/pledge amount/i), { target: { value: '100' } });
      fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));
      fireEvent.click(await screen.findByRole('button', { name: /simulate successful payment/i }));

      await settle();

      await waitFor(() => expect(screen.getByText(/What's Next\?/i)).toBeInTheDocument());
    } finally {
      jest.useRealTimers();
    }
  });
});

// ProtectedRoute already records `state={{ from: location }}` when it bounces a
// signed-out visitor to /login. The pledge page's sign-in card has to speak the
// same language, or a member who clicks it lands on the dashboard having lost
// the pledge they came to make.
describe('PledgePage sign-in return destination', () => {
  const LoginStub: React.FC = () => {
    const location = useLocation();
    const from = (location.state as any)?.from;
    return <div>login stub, from: {typeof from === 'string' ? from : JSON.stringify(from)}</div>;
  };

  it('tells the login page to come back to /pledge', () => {
    mockUseActiveCampaign.mockReturnValue({ campaign: CAMPAIGN, loading: false, error: null });
    mockUsePledgeBalance.mockReturnValue({ balance: null, loading: false });
    mockUseAuth.mockReturnValue({ user: null, currentUser: null, firebaseUser: null });

    render(
      <MemoryRouter initialEntries={['/pledge']}>
        <I18nProvider><LanguageProvider>
          <Routes>
            <Route path="/pledge" element={<PledgePage />} />
            <Route path="/login" element={<LoginStub />} />
          </Routes>
        </LanguageProvider></I18nProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /sign in to pledge/i }));

    expect(screen.getByText(/login stub, from: \/pledge/)).toBeInTheDocument();
  });
});
