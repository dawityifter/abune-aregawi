import React, { useState } from 'react';
import { render, act } from '@testing-library/react';
import StripePayment from '../StripePayment';
import ACHPayment from '../ACHPayment';

// Stripe has not loaded, so processPayment stops at its first guard and reports
// through onError — which lets the test see which onError it was built with.
jest.mock('@stripe/react-stripe-js', () => ({
  useStripe: () => null,
  useElements: () => null,
  CardElement: () => <div data-testid="card-element" />,
}));

jest.mock('../../config/stripe', () => ({
  createPaymentIntent: jest.fn(),
  confirmPayment: jest.fn(),
}));

const mockT = (key: string) => key;
jest.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: mockT, language: 'en' }),
}));

const donationData = {
  amount: 50,
  donation_type: 'one-time' as const,
  payment_method: 'card' as const,
  donor_first_name: 'Test',
  donor_last_name: 'Donor',
  donor_email: 'donor@example.com',
};

type PaymentComponent = typeof StripePayment | typeof ACHPayment;

/**
 * Wired the way DonatePage and AddPaymentModal wire it: every callback is a new
 * function on each render, and the processor handed up is kept in state.
 */
function makeParent(Payment: PaymentComponent) {
  const readyCalls = { count: 0 };
  const errorsSeenBy: number[] = [];
  let exposed: (() => Promise<void>) | null = null;
  let bumpVersion: () => void = () => {};

  const Parent: React.FC = () => {
    const [version, setVersion] = useState(1);
    const [, setProcessPayment] = useState<(() => Promise<void>) | null>(null);
    bumpVersion = () => setVersion((v) => v + 1);

    return (
      <Payment
        donationData={donationData}
        onSuccess={() => {}}
        onError={() => errorsSeenBy.push(version)}
        onCancel={() => {}}
        inline
        onPaymentReady={(fn) => {
          readyCalls.count += 1;
          exposed = fn;
          // A render loop never settles inside act(), so the test would hang
          // rather than fail. Stop feeding it once it has clearly started.
          if (readyCalls.count > 20) return;
          setProcessPayment(() => fn);
        }}
      />
    );
  };

  return {
    Parent,
    readyCalls,
    errorsSeenBy,
    getExposed: () => exposed,
    bumpVersion: () => bumpVersion(),
  };
}

describe.each([
  ['StripePayment', StripePayment],
  ['ACHPayment', ACHPayment],
])('%s onPaymentReady', (_name, Payment) => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('settles instead of re-rendering its parent forever', () => {
    const { Parent, readyCalls } = makeParent(Payment);

    render(<Parent />);

    const loopErrors = consoleError.mock.calls.filter((args) =>
      String(args[0]).includes('Maximum update depth exceeded')
    );
    expect(loopErrors).toHaveLength(0);
    expect(readyCalls.count).toBeLessThanOrEqual(2);
  });

  it('hands up a processor that uses the latest props when it is called', async () => {
    const { Parent, errorsSeenBy, getExposed, bumpVersion } = makeParent(Payment);

    render(<Parent />);
    act(() => bumpVersion());

    await act(async () => {
      await getExposed()!();
    });

    expect(errorsSeenBy).toEqual([2]);
  });
});
