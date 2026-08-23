'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

// The whitelist is a plain array in the controller module. Reading it directly
// is the smallest honest test of the silent-downgrade hazard: a purpose that
// is not on the list becomes 'donation' with no error anywhere.
const fs = require('fs');
const path = require('path');

describe('donation purpose whitelist', () => {
  it('admits pledge_drive so a pledge donation is not silently downgraded', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../controllers/donationController.js'), 'utf8'
    );
    const match = source.match(/const allowedTypes = \[([^\]]+)\]/);
    expect(match).not.toBeNull();

    const types = match[1].split(',').map((s) => s.trim().replace(/['"]/g, ''));
    expect(types).toContain('pledge_drive');
  });
});
