// Event merchandise (t-shirt) ordering.
//
// Deliberately separate from config/stripe.ts: that file is the donation flow's
// Payment Intent + Stripe Elements path. Merchandise uses hosted Stripe
// Checkout and never loads Stripe.js at all, so the public order page costs a
// visitor nothing extra to open.

/** One size and what it costs. Price is PER SIZE — an L costs more than an S. */
export interface MerchSize {
  size: string;
  /** Price in CENTS, as the server holds it. */
  unit_amount: number;
  /**
   * Shirts left to sell online. 0 is sold out. A snapshot from when the page
   * loaded — the server re-checks at checkout.
   */
  available: number;
}

export interface MerchProduct {
  /**
   * Stable identifier for the garment, sent with every order line. Not the
   * display name: that carries a ™ and is the sort of string that gets
   * reworded, and an order must not change meaning because copy was tidied.
   */
  product_key: string;
  product_name: string;
  // Deliberately no product-level unit_amount: a default here would silently
  // misprice any size that ever differs from the others.
  sizes: MerchSize[];
  max_quantity_per_size: number;
}

export interface MerchCatalog {
  event_key: string;
  description: string;
  currency: string;
  /**
   * Every garment the event sells. Youth and adult shirts are different items
   * that share size letters, so the page renders a picker per product and a
   * line is identified by product AND size.
   */
  products: MerchProduct[];
  tax_applies: boolean;
}

export interface MerchOrderItemRequest {
  product_key: string;
  size: string;
  quantity: number;
  // No price field, deliberately. The server prices every line from its own
  // catalog; sending one would only suggest it could be negotiated.
}

export interface MerchCheckoutRequest {
  event_key: string;
  purchaser_name: string;
  /** Required: pickup is arranged by phone. */
  purchaser_phone: string;
  /**
   * Optional. Stripe Checkout collects its own email for the receipt, so an
   * order without one here is still reachable — the webhook stores whatever
   * Stripe gathered.
   */
  purchaser_email?: string;
  items: MerchOrderItemRequest[];
}

export interface MerchCheckoutResponse {
  success: boolean;
  url: string;
  session_id: string;
  order_id: number;
}

/** Cents to a displayable amount, e.g. 2500 -> "$25.00". */
export const formatMoney = (cents: number, currency = 'usd'): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(cents / 100);

export const fetchMerchCatalog = async (eventKey?: string): Promise<MerchCatalog> => {
  const query = eventKey ? `?event_key=${encodeURIComponent(eventKey)}` : '';
  const response = await fetch(`${process.env.REACT_APP_API_URL}/api/merch/catalog${query}`);

  if (!response.ok) {
    throw new Error('Failed to load the merchandise catalog');
  }

  return response.json();
};

export const createMerchCheckoutSession = async (
  payload: MerchCheckoutRequest
): Promise<MerchCheckoutResponse> => {
  const response = await fetch(`${process.env.REACT_APP_API_URL}/api/merch/checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    let message = data.message || 'Failed to start checkout';
    // express-validator returns a per-field array; surfacing it tells the
    // purchaser which box to fix instead of "Validation failed".
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      message = `${message}: ${data.errors.map((e: any) => e.msg).join(', ')}`;
    }

    const error = new Error(message);
    // A 500 carries the real cause in `data.error` — a Sequelize or Stripe
    // message. It stays OFF `message`, because that string is rendered to the
    // purchaser and raw database internals are not theirs to read, but it is
    // attached here and logged so the console says something actionable.
    // Dropping it entirely (as this once did) made a not-null constraint
    // violation indistinguishable from any other failure.
    if (data.error) {
      (error as Error & { detail?: string }).detail = data.error;
      console.error('[merch] checkout-session failed:', data.error);
    }
    throw error;
  }

  return data;
};
