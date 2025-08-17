'use strict';

// Simple, environment-driven notification placeholders. Replace with email/Slack later.
// Config via env:
// - NOTIFY_NEW_MEMBER: 'log' | 'off' (default 'log')
// - NOTIFY_CHANNEL: free text (e.g., 'slack', 'email') for future use

const mode = (process.env.NOTIFY_NEW_MEMBER || 'log').toLowerCase();

function newMemberRegistered(payload) {
  // payload: { id, firstName, lastName, phoneNumber, email }
  if (mode === 'off') return;
  try {
    const msg = {
      event: 'new_member_registered',
      at: new Date().toISOString(),
      channel: process.env.NOTIFY_CHANNEL || 'log',
      member: payload,
    };
    // Placeholder delivery: console log for now
    // Swap to Slack/email integration later
    // eslint-disable-next-line no-console
    console.log('📣 Notification:', JSON.stringify(msg));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Notification error (ignored):', e.message);
  }
}

module.exports = {
  newMemberRegistered,
};
