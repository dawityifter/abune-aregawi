import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import DonatePage from '../DonatePage';

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
      {component}
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
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '50.00' } });
    fireEvent.change(screen.getByDisplayValue('John'), { target: { value: 'John' } });
    fireEvent.change(screen.getByDisplayValue('Doe'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByDisplayValue('test@example.com'), { target: { value: 'test@example.com' } });
    
    // Submit the form by clicking the submit button
    const submitButton = screen.getByRole('button', { name: /Continue to Payment/ });
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
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '50.00' } });
    fireEvent.change(screen.getByDisplayValue('John'), { target: { value: 'John' } });
    fireEvent.change(screen.getByDisplayValue('Doe'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByDisplayValue('test@example.com'), { target: { value: 'test@example.com' } });
    
    // Submit the form by clicking the submit button
    const submitButton = screen.getByRole('button', { name: /Continue to Payment/ });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('ach-payment')).toBeInTheDocument();
      expect(screen.queryByTestId('stripe-payment')).not.toBeInTheDocument();
    });
  });

  test('validates required fields before showing payment form', () => {
    renderWithProviders(<DonatePage />);
    
    // Try to submit without filling required fields
    const submitButton = screen.getByRole('button', { name: /Continue to Payment/ });
    fireEvent.click(submitButton);
    
    // Should show validation error via alert
    expect(mockAlert).toHaveBeenCalledWith('Please enter a valid amount (minimum $1.00)');
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