import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BaptismalNamePrompt from '../BaptismalNamePrompt';
import { I18nProvider } from '../../i18n/I18nProvider';

/**
 * The prompt must appear exactly once, for exactly the people we lack a name
 * for, and must never overwrite anything else on the member's record.
 */

const mockAuth: { user: any; currentUser: any; firebaseUser: any } = {
  user: null,
  currentUser: null,
  firebaseUser: null
};

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuth
}));

const withMember = (member: Record<string, unknown> | null) => {
  mockAuth.user = member ? { data: { member } } : null;
  mockAuth.currentUser = { uid: 'uid-1', email: 'a@b.example', phoneNumber: '+15550001111' };
  mockAuth.firebaseUser = { getIdToken: async () => 'tok' };
};

const renderPrompt = (lang?: 'en' | 'ti') => {
  if (lang) localStorage.setItem('app.lang', lang);
  return render(<I18nProvider><BaptismalNamePrompt /></I18nProvider>);
};

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }) as any;
});
afterEach(() => jest.restoreAllMocks());

describe('who sees it', () => {
  it('asks a member who has no baptismal name', () => {
    withMember({ id: 1, firstName: 'A' });
    renderPrompt();
    expect(screen.getByText(/What is your baptismal name/i)).toBeInTheDocument();
  });

  it('stays hidden for a member who already has one', () => {
    withMember({ id: 1, baptismName: 'Welde Mariam' });
    const { container } = renderPrompt();
    expect(container).toBeEmptyDOMElement();
  });

  it('accepts the snake_case shape the API also returns', () => {
    withMember({ id: 1, baptism_name: 'Gebre Michael' });
    const { container } = renderPrompt();
    expect(container).toBeEmptyDOMElement();
  });

  it('stays hidden for a half-registered session', () => {
    withMember({ id: 1, _temp: true });
    const { container } = renderPrompt();
    expect(container).toBeEmptyDOMElement();
  });

  it('stays hidden when there is no member at all', () => {
    withMember(null);
    const { container } = renderPrompt();
    expect(container).toBeEmptyDOMElement();
  });
});

describe('saving', () => {
  it('sends only the baptismal name, so nothing else on the record is touched', async () => {
    withMember({ id: 1, firstName: 'A' });
    renderPrompt();

    await userEvent.type(screen.getByRole('textbox'), '  Welde Mariam  ');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/api/members/profile/firebase/uid-1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ baptismName: 'Welde Mariam' });
  });

  it('sends the auth token', async () => {
    withMember({ id: 1 });
    renderPrompt();
    await userEvent.type(screen.getByRole('textbox'), 'Gebre Michael');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const init = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('disappears once answered', async () => {
    withMember({ id: 1 });
    const { container } = renderPrompt();
    await userEvent.type(screen.getByRole('textbox'), 'Welde Mariam');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('will not submit an empty or whitespace-only value', async () => {
    withMember({ id: 1 });
    renderPrompt();
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox'), '   ');
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps the typed value and explains when saving fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
    withMember({ id: 1 });
    renderPrompt();
    await userEvent.type(screen.getByRole('textbox'), 'Welde Mariam');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/did not save/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Welde Mariam');
  });
});

describe('not nagging', () => {
  it('never returns after being dismissed', async () => {
    withMember({ id: 1 });
    const { container, unmount } = renderPrompt();
    await userEvent.click(screen.getByRole('button', { name: /not now/i }));
    expect(container).toBeEmptyDOMElement();

    unmount();
    const second = renderPrompt();
    expect(second.container).toBeEmptyDOMElement();
  });
});

describe('bilingual', () => {
  it('asks in Tigrigna when that is the chosen language', () => {
    withMember({ id: 1 });
    renderPrompt('ti');
    expect(screen.getByText(/ስመ ጥምቀትካ እንታይ እዩ/)).toBeInTheDocument();
  });
});
