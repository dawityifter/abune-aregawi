import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import PledgeCheckoutForm from '../PledgeCheckoutForm';

jest.mock('../../StripePayment', () => () => <div>stripe</div>);
jest.mock('../../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../../contexts/AuthContext'),
  useAuth: () => ({ user: null, currentUser: null, firebaseUser: null })
}));

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
});
