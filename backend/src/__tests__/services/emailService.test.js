'use strict';
jest.mock('nodemailer');
const nodemailer = require('nodemailer');

describe('emailService', () => {
  let sendMailMock;

  beforeEach(() => {
    sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test-id' });
    nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });
    process.env.GMAIL_CLIENT_ID = 'test-client-id';
    process.env.GMAIL_CLIENT_SECRET = 'test-secret';
    process.env.GMAIL_REFRESH_TOKEN = 'test-refresh-token';
  });

  afterEach(() => jest.resetModules());

  it('calls sendMail with correct fields', async () => {
    const { sendEmail } = require('../../services/emailService');
    await sendEmail({
      to: 'member@example.com',
      subject: 'Test Subject',
      text: 'Hello',
      attachments: [{ filename: 'test.pdf', content: Buffer.from('pdf') }]
    });
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'member@example.com',
      subject: 'Test Subject',
      text: 'Hello',
      attachments: expect.arrayContaining([expect.objectContaining({ filename: 'test.pdf' })])
    }));
  });

  it('throws if Gmail env vars are missing', async () => {
    delete process.env.GMAIL_CLIENT_ID;
    const { sendEmail } = require('../../services/emailService');
    await expect(sendEmail({ to: 'x@x.com', subject: 's', text: 't' }))
      .rejects.toThrow('Missing Gmail OAuth');
  });
});
