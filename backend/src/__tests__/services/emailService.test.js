'use strict';
jest.mock('nodemailer');

describe('emailService', () => {
  let sendMailMock;
  let nodemailer;

  beforeEach(() => {
    jest.resetModules();
    nodemailer = require('nodemailer');
    sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test-id' });
    nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });
    delete process.env.MAILER_GMAIL_CLIENT_ID;
    delete process.env.MAILER_GMAIL_CLIENT_SECRET;
    delete process.env.MAILER_GMAIL_REFRESH_TOKEN;
    delete process.env.MAILER_GMAIL_USER;
    process.env.GMAIL_CLIENT_ID = 'test-client-id';
    process.env.GMAIL_CLIENT_SECRET = 'test-secret';
    process.env.GMAIL_REFRESH_TOKEN = 'test-refresh-token';
    process.env.GMAIL_USER = 'fallback@example.com';
  });

  it('calls sendMail with correct fields', async () => {
    const { sendEmail } = require('../../services/emailService');
    await sendEmail({
      to: 'member@example.com',
      subject: 'Test Subject',
      text: 'Hello',
      attachments: [{ filename: 'test.pdf', content: Buffer.from('pdf') }]
    });
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
      from: '"Debre Tsehay Abune Aregawi Church" <fallback@example.com>',
      to: 'member@example.com',
      subject: 'Test Subject',
      text: 'Hello',
      attachments: expect.arrayContaining([expect.objectContaining({ filename: 'test.pdf' })])
    }));
  });

  it('prefers dedicated mailer env vars when present', async () => {
    process.env.MAILER_GMAIL_CLIENT_ID = 'mailer-client-id';
    process.env.MAILER_GMAIL_CLIENT_SECRET = 'mailer-secret';
    process.env.MAILER_GMAIL_REFRESH_TOKEN = 'mailer-refresh-token';
    process.env.MAILER_GMAIL_USER = 'mailer@example.com';

    const { sendEmail } = require('../../services/emailService');
    await sendEmail({ to: 'x@x.com', subject: 's', text: 't' });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      auth: expect.objectContaining({
        user: 'mailer@example.com',
        clientId: 'mailer-client-id',
        clientSecret: 'mailer-secret',
        refreshToken: 'mailer-refresh-token'
      })
    }));
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
      from: '"Debre Tsehay Abune Aregawi Church" <mailer@example.com>'
    }));
  });

  it('throws if mail OAuth env vars are missing', async () => {
    delete process.env.MAILER_GMAIL_CLIENT_ID;
    delete process.env.MAILER_GMAIL_CLIENT_SECRET;
    delete process.env.MAILER_GMAIL_REFRESH_TOKEN;
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_CLIENT_ID;
    delete process.env.GMAIL_CLIENT_SECRET;
    delete process.env.GMAIL_REFRESH_TOKEN;
    const { sendEmail } = require('../../services/emailService');
    await expect(sendEmail({ to: 'x@x.com', subject: 's', text: 't' }))
      .rejects.toThrow('Missing mail OAuth env vars');
  });
});
