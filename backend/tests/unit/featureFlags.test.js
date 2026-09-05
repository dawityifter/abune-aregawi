const { isZelleGmailCreateEnabled } = require('../../src/config/featureFlags');

describe('featureFlags.isZelleGmailCreateEnabled', () => {
    const original = process.env.ZELLE_GMAIL_CREATE_ENABLED;

    afterEach(() => {
        if (original === undefined) delete process.env.ZELLE_GMAIL_CREATE_ENABLED;
        else process.env.ZELLE_GMAIL_CREATE_ENABLED = original;
    });

    test('defaults to false when unset', () => {
        delete process.env.ZELLE_GMAIL_CREATE_ENABLED;
        expect(isZelleGmailCreateEnabled()).toBe(false);
    });

    test('is false for "false", empty string and arbitrary values', () => {
        for (const value of ['false', '', 'no', '1', 'yes']) {
            process.env.ZELLE_GMAIL_CREATE_ENABLED = value;
            expect(isZelleGmailCreateEnabled()).toBe(false);
        }
    });

    test('is true only for "true", case-insensitively', () => {
        for (const value of ['true', 'TRUE', 'True']) {
            process.env.ZELLE_GMAIL_CREATE_ENABLED = value;
            expect(isZelleGmailCreateEnabled()).toBe(true);
        }
    });

    test('is read at call time, not module load time', () => {
        delete process.env.ZELLE_GMAIL_CREATE_ENABLED;
        expect(isZelleGmailCreateEnabled()).toBe(false);
        process.env.ZELLE_GMAIL_CREATE_ENABLED = 'true';
        expect(isZelleGmailCreateEnabled()).toBe(true);
    });
});
