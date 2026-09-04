const { ZelleEmailQueue, Member } = require('../../src/models');

describe('ZelleEmailQueue match audit columns', () => {
    let member;

    beforeAll(async () => {
        member = await Member.create({
            first_name: 'Test',
            last_name: 'Member',
            phone_number: '+15550009999',
            is_active: true
        });
    });

    test('persists matched_by, matched_at and a MATCHED status', async () => {
        const matchedAt = new Date('2026-08-29T12:00:00Z');
        const row = await ZelleEmailQueue.create({
            external_id: 'zelle:SCHEMATEST1',
            payer_name: 'SYNTHETIC PAYER',
            amount: 25.00,
            payment_date: '2026-08-29',
            status: 'MATCHED',
            matched_member_id: member.id,
            matched_by: member.id,
            matched_at: matchedAt
        });

        await row.reload();
        expect(row.status).toBe('MATCHED');
        expect(String(row.matched_by)).toBe(String(member.id));
        expect(new Date(row.matched_at).toISOString()).toBe(matchedAt.toISOString());
    });

    test('leaves the audit columns null when a row is only queued', async () => {
        const row = await ZelleEmailQueue.create({
            external_id: 'zelle:SCHEMATEST2',
            status: 'NEEDS_REVIEW'
        });
        expect(row.matched_by).toBeNull();
        expect(row.matched_at).toBeNull();
    });
});
