import React from 'react';
import { render } from '@testing-library/react';
import ACHPayment from '../ACHPayment';

describe('ACHPayment', () => {
  it('should import successfully', () => {
    // If this test passes, the import works in the test environment
    expect(ACHPayment).toBeDefined();
  });
});
