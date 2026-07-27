import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import SquareReview from '../SquareReview';

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { email: 'treasurer@test.org' },
    firebaseUser: { getIdToken: async () => 'test-token' }
  })
}));
jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k })
}));

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      items: [{
        id: 'row-1',
        square_payment_id: 'sqpmt_1',
        amount: '30.00',
        buyer_name: 'Jane Doe',
        status: 'NEEDS_REVIEW'
      }]
    })
  }) as any;
});

it('renders a Square payment row from the queue', async () => {
  render(<SquareReview />);
  await waitFor(() => expect(screen.getByText(/Jane Doe/)).toBeInTheDocument());
});
