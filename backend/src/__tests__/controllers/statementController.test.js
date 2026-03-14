'use strict';
jest.mock('pdfkit');
jest.mock('../../models', () => ({
  Member: { findOne: jest.fn() },
  Transaction: { findAll: jest.fn() },
  IncomeCategory: {},
  sequelize: {
    where: jest.fn((a, b) => ({ _where: true })),
    fn: jest.fn((name, ...args) => ({ _fn: name, args })),
    col: jest.fn((name) => ({ _col: name })),
  },
}));
jest.mock('../../services/emailService', () => ({ sendEmail: jest.fn() }));

const PDFDocument = require('pdfkit');
const { Member, Transaction } = require('../../models');
const { sendEmail } = require('../../services/emailService');

const mockDoc = {
  on: jest.fn((event, cb) => { if (event === 'end') setTimeout(cb, 0); }),
  image: jest.fn().mockReturnThis(),
  fontSize: jest.fn().mockReturnThis(),
  font: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  moveDown: jest.fn().mockReturnThis(),
  moveTo: jest.fn().mockReturnThis(),
  lineTo: jest.fn().mockReturnThis(),
  stroke: jest.fn().mockReturnThis(),
  lineWidth: jest.fn().mockReturnThis(),
  fillColor: jest.fn().mockReturnThis(),
  switchToPage: jest.fn().mockReturnThis(),
  flushPages: jest.fn().mockReturnThis(),
  addPage: jest.fn().mockReturnThis(),
  bufferedPageRange: jest.fn().mockReturnValue({ start: 0, count: 1 }),
  page: { height: 792, width: 612 },
  y: 200,
  end: jest.fn(),
};
PDFDocument.mockImplementation(() => mockDoc);

const mockMember = {
  id: 1,
  first_name: 'Dawit',
  last_name: 'Yifter',
  email: 'dawit@example.com',
  spouse_name: 'Sara',
  firebase_uid: 'uid-123',
};
const mockTransactions = [
  { payment_date: '2025-03-01', amount: '50.00', incomeCategory: { name: 'Membership Due' } },
  { payment_date: '2025-06-15', amount: '100.00', incomeCategory: { name: 'Tithe' } },
];

describe('statementController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Member.findOne.mockResolvedValue(mockMember);
    Transaction.findAll.mockResolvedValue(mockTransactions);
  });

  describe('downloadStatement', () => {
    it('returns 400 for invalid year', async () => {
      const { downloadStatement } = require('../../controllers/statementController');
      const req = { firebaseUid: 'uid-123', query: { year: 'abc' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await downloadStatement(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when member not found', async () => {
      Member.findOne.mockResolvedValue(null);
      const { downloadStatement } = require('../../controllers/statementController');
      const req = { firebaseUid: 'uid-unknown', query: { year: '2025' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await downloadStatement(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('emailStatement', () => {
    it('returns 400 when member has no email', async () => {
      Member.findOne.mockResolvedValue({ ...mockMember, email: null });
      const { emailStatement } = require('../../controllers/statementController');
      const req = { firebaseUid: 'uid-123', body: { year: 2025 } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await emailStatement(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('email') }));
    });
  });
});
