import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import SmsBroadcast from '../SmsBroadcast';

// Every field here must keep a STABLE identity across renders. Returning a
// fresh object from useAuth makes getUserProfile a new function each render,
// which retriggers the profile effect that depends on it — an infinite fetch
// loop that exhausts the heap rather than failing an assertion.
const mockAuthValue = {
  currentUser: { uid: 'admin-uid', role: 'admin', roles: ['admin'] },
  firebaseUser: { getIdToken: async () => 'token' },
  getUserProfile: async () => ({ data: { member: { role: 'admin', roles: ['admin'] } } })
};

jest.mock('../../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../../contexts/AuthContext'),
  useAuth: () => mockAuthValue
}));

const renderPanel = () => render(
  <I18nProvider><LanguageProvider><SmsBroadcast /></LanguageProvider></I18nProvider>
);

// Only the pledge preview matters here; everything else answers empty so the
// panel mounts without noise.
const respondWith = (pledgePayload: any) => {
  (global.fetch as jest.Mock) = jest.fn(async (url: string) => {
    if (String(url).includes('PledgesRecipients')) {
      return { ok: true, json: async () => ({ success: true, data: pledgePayload }) };
    }
    return { ok: true, json: async () => ({ success: true, data: { departments: [], recipients: [], totalCount: 0 } }) };
  }) as any;
};

// The recipient type is a row of buttons, not a select.
const choosePendingPledges = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /pending pledges/i }));
};

afterEach(() => { delete (global as any).fetch; });

/**
 * These audiences used to be selected by legacy_status with no campaign
 * filter, so they targeted whoever was hand-marked during the 2025 drive. Now
 * they follow the live drive — which means the page has to say what happens
 * when there is no live drive, rather than showing a bare zero that could mean
 * anything.
 */
describe('SMS pledge audience follows the live drive', () => {
  it('names the drive the message will go to', async () => {
    respondWith({
      recipients: [{ id: 1, firstName: 'A', lastName: 'B', phoneNumber: '+15550000001' }],
      totalCount: 1,
      campaign: { id: 20, name: '2026 Pledge Drive' }
    });

    renderPanel();
    await choosePendingPledges();

    expect(await screen.findByText(/2026 Pledge Drive/)).toBeInTheDocument();
  });

  it('says no drive is running instead of showing an unexplained zero', async () => {
    respondWith({ recipients: [], totalCount: 0, campaign: null });

    renderPanel();
    await choosePendingPledges();

    await waitFor(() => {
      expect(screen.getByTestId('pledge-no-live-drive')).toBeInTheDocument();
    });
  });

  it('blocks sending while no drive is running', async () => {
    respondWith({ recipients: [], totalCount: 0, campaign: null });

    renderPanel();
    await choosePendingPledges();

    await waitFor(() => expect(screen.getByTestId('pledge-no-live-drive')).toBeInTheDocument());

    const send = screen.getByRole('button', { name: /send/i });
    expect(send).toBeDisabled();
  });
});
