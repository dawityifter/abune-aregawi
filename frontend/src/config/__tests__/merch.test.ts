import { createMerchCheckoutSession, MerchCheckoutRequest } from '../merch';

const payload: MerchCheckoutRequest = {
  event_key: 'october_5k_fundraiser',
  purchaser_name: 'Test Purchaser',
  purchaser_email: 'buyer@example.org',
  items: [{ size: 'M', quantity: 1 }]
};

const mockFetch = (status: number, body: any) => {
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  });
};

afterEach(() => {
  jest.restoreAllMocks();
  delete (global as any).fetch;
});

describe('createMerchCheckoutSession error reporting', () => {
  /**
   * A 500 from this endpoint carries the real cause in `error` (a Sequelize or
   * Stripe message) and a safe summary in `message`. Dropping `error` on the
   * floor — as this once did — left the browser console showing only "Failed to
   * start checkout", which says nothing about what to fix.
   */
  it('keeps the server detail on the thrown error for diagnostics', async () => {
    mockFetch(500, {
      success: false,
      message: 'Failed to start checkout',
      error: 'null value in column "stripe_checkout_session_id" violates not-null constraint'
    });

    await expect(createMerchCheckoutSession(payload)).rejects.toThrow('Failed to start checkout');

    try {
      await createMerchCheckoutSession(payload);
    } catch (err) {
      expect((err as any).detail).toMatch(/not-null constraint/);
    }
  });

  // Raw database and Stripe internals must never reach a purchaser. The detail
  // rides on the error object for the console; the message is what the UI shows.
  it('does not put the server detail into the user-facing message', async () => {
    mockFetch(500, {
      success: false,
      message: 'Failed to start checkout',
      error: 'null value in column "stripe_checkout_session_id" violates not-null constraint'
    });

    try {
      await createMerchCheckoutSession(payload);
      throw new Error('should have rejected');
    } catch (err) {
      expect((err as Error).message).toBe('Failed to start checkout');
      expect((err as Error).message).not.toMatch(/column|constraint|null value/i);
    }
  });

  // Validation failures are the purchaser's to fix, so these DO belong in the
  // visible message.
  it('still surfaces field validation errors to the purchaser', async () => {
    mockFetch(400, {
      success: false,
      message: 'Validation failed',
      errors: [{ msg: 'A valid email address is required' }]
    });

    await expect(createMerchCheckoutSession(payload))
      .rejects.toThrow(/A valid email address is required/);
  });

  it('returns the checkout url on success', async () => {
    mockFetch(200, {
      success: true,
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
      session_id: 'cs_test_1',
      order_id: 7
    });

    const result = await createMerchCheckoutSession(payload);

    expect(result.url).toBe('https://checkout.stripe.com/c/pay/cs_test_1');
    expect(result.order_id).toBe(7);
  });
});
