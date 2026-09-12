import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import DonatePage from '../DonatePage';
import { I18nProvider } from '../../i18n/I18nProvider';
import { LanguageProvider } from '../../contexts/LanguageContext';

// Mock the Stripe components
jest.mock('../StripePayment', () => {
  return function MockStripePayment() {
    return <div data-testid="stripe-payment">Stripe Payment Form</div>;
  };
});

jest.mock('../ACHPayment', () => {
  return function MockACHPayment() {
    return <div data-testid="ach-payment">ACH Payment Form</div>;
  };
});

// Mock the AuthContext
const mockUseAuth = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Mock alert function
const mockAlert = jest.fn();
global.alert = mockAlert;

const mockUser = {
  id: '1',
  email: 'test@example.com',
  first_name: 'John',
  last_name: 'Doe',
  phone_number: '1234567890',
  street_line1: '123 Main St',
  postal_code: '12345'
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <I18nProvider>
        <LanguageProvider>
          {component}
        </LanguageProvider>
      </I18nProvider>
    </BrowserRouter>
  );
};

describe('DonatePage', () => {
  beforeEach(() => {
    // Mock the AuthContext
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false
    });
    // Clear alert mock
    mockAlert.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders donation form with payment method selection', () => {
    renderWithProviders(<DonatePage />);
    
    expect(screen.getByText('Support Our Church')).toBeInTheDocument();
    expect(screen.getByText('Online Donation')).toBeInTheDocument();
    expect(screen.getByText('Credit/Debit Card')).toBeInTheDocument();
    expect(screen.getByText('Bank Account (ACH)')).toBeInTheDocument();
  });

  test('shows card payment form when card payment method is selected', async () => {
    renderWithProviders(<DonatePage />);
    
    // Fill in required fields
    fireEvent.change(screen.getByLabelText('Donation Amount'), { target: { value: '50.00' } });
    fireEvent.change(screen.getByDisplayValue('John'), { target: { value: 'John' } });
    fireEvent.change(screen.getByDisplayValue('Doe'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByDisplayValue('test@example.com'), { target: { value: 'test@example.com' } });
    
    // Submit the form by clicking the submit button
    const submitButton = screen.getByRole('button', { name: /Give|Choose an amount/ });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('stripe-payment')).toBeInTheDocument();
      expect(screen.queryByTestId('ach-payment')).not.toBeInTheDocument();
    });
  });

  test('shows ACH payment form when ACH payment method is selected', async () => {
    renderWithProviders(<DonatePage />);
    
    // Select ACH payment method
    const achRadio = screen.getByLabelText('Bank Account (ACH)');
    fireEvent.click(achRadio);
    
    // Fill in required fields
    fireEvent.change(screen.getByLabelText('Donation Amount'), { target: { value: '50.00' } });
    fireEvent.change(screen.getByDisplayValue('John'), { target: { value: 'John' } });
    fireEvent.change(screen.getByDisplayValue('Doe'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByDisplayValue('test@example.com'), { target: { value: 'test@example.com' } });
    
    // Submit the form by clicking the submit button
    const submitButton = screen.getByRole('button', { name: /Give|Choose an amount/ });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('ach-payment')).toBeInTheDocument();
      expect(screen.queryByTestId('stripe-payment')).not.toBeInTheDocument();
    });
  });

  test('validates required fields before showing payment form', () => {
    renderWithProviders(<DonatePage />);
    
    // Try to submit without filling required fields
    const submitButton = screen.getByRole('button', { name: /Give|Choose an amount/ });
    fireEvent.click(submitButton);
    
    // Should show validation error via alert (format validation first)
    expect(mockAlert).toHaveBeenCalledWith('Please enter a valid amount (numbers only, up to 2 decimals).');
  });


  test('offers preset amounts so nobody has to meet an empty field', () => {
    renderWithProviders(<DonatePage />);

    ['$25', '$50', '$100', '$250'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  test('tapping a preset fills the amount and marks itself chosen', () => {
    renderWithProviders(<DonatePage />);

    const fifty = screen.getByRole('button', { name: '$50' });
    expect(fifty).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(fifty);

    expect(screen.getByLabelText('Donation Amount')).toHaveValue('50.00');
    expect(fifty).toHaveAttribute('aria-pressed', 'true');
    // The preset stores an already-normalised value, so typing the same figure
    // by hand and blurring cannot un-highlight the chosen preset.
    expect(screen.getByRole('button', { name: '$25' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('the submit button names the gift rather than $0.00', () => {
    renderWithProviders(<DonatePage />);

    expect(screen.getByRole('button', { name: 'Choose an amount' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '$100' }));

    expect(screen.getByRole('button', { name: 'Give $100.00' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\$0\.00/ })).not.toBeInTheDocument();
  });

  test('keeps Zelle and cheque available but out of the card path', () => {
    renderWithProviders(<DonatePage />);

    // Collapsed by default, so it no longer competes with the card form.
    const disclosure = screen.getByText('Other ways to give');
    expect(disclosure.closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText('Donate via Zelle')).toBeInTheDocument();
  });

  test('prefills donor information from user profile', () => {
    renderWithProviders(<DonatePage />);
    
    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1234567890')).toBeInTheDocument();
    expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12345')).toBeInTheDocument();
  });
}); 