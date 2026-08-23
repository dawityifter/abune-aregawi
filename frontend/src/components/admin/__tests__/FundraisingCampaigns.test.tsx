import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import FundraisingCampaigns from '../FundraisingCampaigns';

const mockFetchAll = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

const mockDonorsFor = jest.fn();
jest.mock('../CampaignDonors', () => (props: any) => {
  mockDonorsFor(props.campaignId);
  return <div>donors-panel</div>;
});

jest.mock('../../../utils/pledgeCampaignApi', () => ({
  fetchAllCampaigns: () => mockFetchAll(),
  createCampaign: (input: unknown) => mockCreate(input),
  updateCampaign: (id: number, input: unknown) => mockUpdate(id, input)
}));

const CAMPAIGN = {
  id: 7, slug: 'test-drive', name: 'Test Drive', name_ti: null,
  description: null, description_ti: null,
  start_date: '2026-01-01', end_date: '2026-12-31',
  goal_amount: '50000.00', currency: 'usd', status: 'draft' as const,
  default_payment_type: 'pledge_drive', income_category_id: null,
  totals: null
};

const WITH_TOTALS = {
  ...CAMPAIGN, id: 9, name: 'Closed Drive', status: 'closed' as const,
  totals: {
    total_pledged: '70119.00', total_collected: '52000.00',
    outstanding: '18119.00', percent_to_goal: '74.1',
    pledge_count: 149, donor_count: 131
  }
};

// Collected exceeds pledged, so the SQL view's outstanding string goes
// negative — this is what an over-fulfilled drive looks like on the wire.
const OVER_FULFILLED = {
  ...CAMPAIGN, id: 11, name: 'Generous Drive', status: 'active' as const,
  totals: {
    total_pledged: '10000.00', total_collected: '11500.00',
    outstanding: '-1500.00', percent_to_goal: '115.0',
    pledge_count: 40, donor_count: 35
  }
};

const renderTab = () => render(
  <I18nProvider><LanguageProvider><FundraisingCampaigns canManage={true} /></LanguageProvider></I18nProvider>
);

const renderReadOnly = () => render(
  <I18nProvider><LanguageProvider><FundraisingCampaigns canManage={false} /></LanguageProvider></I18nProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchAll.mockResolvedValue([CAMPAIGN]);
  mockCreate.mockResolvedValue({ ...CAMPAIGN, id: 8, name: 'New Drive' });
  mockUpdate.mockResolvedValue({ ...CAMPAIGN, status: 'active' });
});

describe('FundraisingCampaigns', () => {
  it('lists existing campaigns with their window and status', async () => {
    renderTab();

    expect(await screen.findByText('Test Drive')).toBeInTheDocument();
    expect(screen.getByText(/2026-01-01/)).toBeInTheDocument();
    expect(screen.getByText(/draft/i)).toBeInTheDocument();
  });

  it('creates a campaign from the form', async () => {
    renderTab();
    await screen.findByText('Test Drive');

    await userEvent.click(screen.getByRole('button', { name: /new campaign/i }));
    await userEvent.type(screen.getByLabelText('Name'), 'Building Drive');
    await userEvent.type(screen.getByLabelText(/start date/i), '2027-01-01');
    await userEvent.type(screen.getByLabelText(/end date/i), '2027-12-31');
    await userEvent.type(screen.getByLabelText(/goal amount/i), '75000');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      name: 'Building Drive',
      start_date: '2027-01-01',
      end_date: '2027-12-31',
      goal_amount: 75000,
      // Derived from the name so an admin never has to invent one.
      slug: 'building-drive'
    });
  });

  it('surfaces the overlap conflict message from the server', async () => {
    mockUpdate.mockRejectedValue(
      new Error('Existing Drive (2026-01-01 – 2026-06-30) is already active for these dates.')
    );
    renderTab();
    await screen.findByText('Test Drive');

    await userEvent.click(screen.getByRole('button', { name: /activate/i }));

    expect(await screen.findByText(/already active for these dates/i)).toBeInTheDocument();
  });
});

describe('editing an existing campaign', () => {
  it('pre-fills the form from the campaign being edited', async () => {
    renderTab();
    await screen.findByText('Test Drive');

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    expect(screen.getByLabelText('Name')).toHaveValue('Test Drive');
    expect(screen.getByLabelText(/goal amount/i)).toHaveValue(50000);
    expect(screen.getByLabelText(/start date/i)).toHaveValue('2026-01-01');
  });

  it('saves a changed goal amount against the existing campaign', async () => {
    renderTab();
    await screen.findByText('Test Drive');

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    await userEvent.clear(screen.getByLabelText(/goal amount/i));
    await userEvent.type(screen.getByLabelText(/goal amount/i), '90000');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][0]).toBe(7);
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({ goal_amount: 90000 });
    // Editing must never create a second campaign.
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('does not change status when editing, so a live drive stays live', async () => {
    renderTab();
    await screen.findByText('Test Drive');

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][1]).not.toHaveProperty('status');
  });

  it('returns to creating a new campaign after a cancelled edit', async () => {
    renderTab();
    await screen.findByText('Test Drive');

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await userEvent.click(screen.getByRole('button', { name: /new campaign/i }));

    // A stale editingId here would silently overwrite the edited campaign.
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });
});


describe('campaign totals', () => {
  beforeEach(() => { mockFetchAll.mockResolvedValue([WITH_TOTALS]); });

  it('reports collected, outstanding, donors and progress to goal', async () => {
    renderTab();

    expect(await screen.findByText('Closed Drive')).toBeInTheDocument();
    expect(screen.getByText(/\$52,000/)).toBeInTheDocument();
    expect(screen.getByText(/\$18,119/)).toBeInTheDocument();
    expect(screen.getByText(/131/)).toBeInTheDocument();
    expect(screen.getByText(/74\.1%/)).toBeInTheDocument();
    // campaign_totals computes this from paid_amount, not pledged.
    expect(screen.getByText(/of goal collected/i)).toBeInTheDocument();
  });

  it('renders a campaign with no totals without crashing', async () => {
    mockFetchAll.mockResolvedValue([CAMPAIGN]);
    renderTab();

    expect(await screen.findByText('Test Drive')).toBeInTheDocument();
  });

  it('shows an over-fulfilled campaign as zero outstanding plus an over-by note, never a negative figure', async () => {
    mockFetchAll.mockResolvedValue([OVER_FULFILLED]);
    renderTab();

    expect(await screen.findByText('Generous Drive')).toBeInTheDocument();
    // $1,500 collected beyond the $10,000 pledged.
    expect(screen.getByText(/over by/i)).toBeInTheDocument();
    expect(screen.getByText(/\$1,500/)).toBeInTheDocument();
    expect(screen.queryByText(/-\$1,500/)).not.toBeInTheDocument();
  });
});

describe('read-only access for non-admin viewers', () => {
  it('shows campaigns but no write controls', async () => {
    renderReadOnly();

    expect(await screen.findByText('Test Drive')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new campaign/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /activate/i })).not.toBeInTheDocument();
  });

  it('still shows the figures a treasurer needs', async () => {
    mockFetchAll.mockResolvedValue([WITH_TOTALS]);
    renderReadOnly();

    expect(await screen.findByText(/\$52,000/)).toBeInTheDocument();
  });
});


describe('drilling into a campaign\'s donors', () => {
  it('opens the donor list for that campaign', async () => {
    renderTab();
    await screen.findByText('Test Drive');

    await userEvent.click(screen.getByRole('button', { name: /view donors/i }));

    expect(await screen.findByText('donors-panel')).toBeInTheDocument();
    expect(mockDonorsFor).toHaveBeenCalledWith(7);
  });

  it('lets a read-only viewer see donors too', async () => {
    renderReadOnly();
    await screen.findByText('Test Drive');

    // Reading donors follows viewRoles, same as reading the campaign itself.
    await userEvent.click(screen.getByRole('button', { name: /view donors/i }));

    expect(await screen.findByText('donors-panel')).toBeInTheDocument();
  });
});
