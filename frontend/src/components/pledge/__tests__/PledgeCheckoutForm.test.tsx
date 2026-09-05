import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import PledgeCheckoutForm from '../PledgeCheckoutForm';

// Capturing the props is the point: what this form actually promises the
// server lives entirely in donationData.metadata, and nothing else in the tree
// renders it. (The `mock` prefix is what lets jest.mock's hoisting reach it.)
const mockStripeProps: any[] = [];
jest.mock('../../StripePayment', () => (props: any) => {
  mockStripeProps.push(props);
  return <div>stripe</div>;
});

const mockUseAuth = jest.fn();
jest.mock('../../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../../contexts/AuthContext'),
  useAuth: () => mockUseAuth()
}));

beforeEach(() => {
  mockStripeProps.length = 0;
  mockUseAuth.mockReturnValue({ user: null, currentUser: null, firebaseUser: null });
});

const lastMetadata = () =>
  mockStripeProps[mockStripeProps.length - 1].donationData.metadata;

const renderForm = (anonymous: boolean) => render(
  <I18nProvider><LanguageProvider>
    <PledgeCheckoutForm anonymous={anonymous} campaignId={7} onSuccess={jest.fn()} />
  </LanguageProvider></I18nProvider>
);

describe('PledgeCheckoutForm', () => {
  it('asks an anonymous giver for a baptism name', () => {
    renderForm(true);
    expect(screen.getByLabelText(/baptism|church name/i)).toBeInTheDocument();
  });

  it('does not ask a signed-in member for a baptism name', () => {
    renderForm(false);
    expect(screen.queryByLabelText(/baptism|church name/i)).not.toBeInTheDocument();
  });

  it('refuses to continue anonymously without a baptism name', async () => {
    renderForm(true);

    fireEvent.change(screen.getByLabelText(/pledge amount/i), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => {
      expect(screen.getByText(/church name is required/i)).toBeInTheDocument();
    });
  });

  it('explains that paying now means paying in full', () => {
    renderForm(false);
    expect(screen.getByText(/in full/i)).toBeInTheDocument();
  });

  // §5.3: anonymity and member-linkage are separate choices. A signed-in
  // member may ask to be shown as anonymous while the church keeps knowing
  // exactly who gave — welding the two together is what forced anyone wanting
  // anonymity to give up their member link.
  it('lets a signed-in member ask to be shown as anonymous without losing their member link', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 42, first_name: 'Signed', last_name: 'In', email: 'signed.in@example.test' },
      currentUser: null, firebaseUser: null
    });
    renderForm(false);

    fireEvent.click(screen.getByLabelText(/show my gift as anonymous/i));
    fireEvent.change(screen.getByLabelText(/pledge amount/i), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => expect(mockStripeProps.length).toBeGreaterThan(0));
    expect(lastMetadata().isAnonymous).toBe('true');
    expect(lastMetadata().memberId).toBe('42');
    // No baptism name is asked for or sent: the member link is the internal
    // identifier, and the server guard accepts it in the baptism name's place.
    expect(lastMetadata().baptismName).toBe('');
    expect(screen.queryByLabelText(/baptism|church name/i)).not.toBeInTheDocument();
  });

  it('sends a signed-in member as named when the box is left unticked', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 42, first_name: 'Signed', last_name: 'In' },
      currentUser: null, firebaseUser: null
    });
    renderForm(false);

    fireEvent.change(screen.getByLabelText(/pledge amount/i), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => expect(mockStripeProps.length).toBeGreaterThan(0));
    expect(lastMetadata().isAnonymous).toBe('false');
    expect(lastMetadata().memberId).toBe('42');
  });

  it('does not offer the checkbox on the walk-up anonymous form', () => {
    renderForm(true);
    expect(screen.queryByLabelText(/show my gift as anonymous/i)).not.toBeInTheDocument();
  });
});
