'use strict';

jest.mock('pdfkit');
jest.mock('../../models', () => ({
  Department: {},
  DepartmentMember: { findAll: jest.fn() },
  Member: {},
  DepartmentMeeting: { findOne: jest.fn() },
  DepartmentTask: {},
  sequelize: {}
}));
jest.mock('../../services/emailService', () => ({ sendEmail: jest.fn() }));
jest.mock('../../utils/activityLogger', () => ({ logActivity: jest.fn() }));

const PDFDocument = require('pdfkit');
const models = require('../../models');
const { sendEmail } = require('../../services/emailService');

const createMockDoc = () => {
  const handlers = {};
  return {
    on: jest.fn((event, cb) => {
      handlers[event] = cb;
      return this;
    }),
    registerFont: jest.fn().mockReturnThis(),
    image: jest.fn().mockReturnThis(),
    fontSize: jest.fn().mockReturnThis(),
    font: jest.fn().mockReturnThis(),
    text: jest.fn(function () { this.y += 12; return this; }),
    moveDown: jest.fn(function (lines = 1) { this.y += 12 * lines; return this; }),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    lineWidth: jest.fn().mockReturnThis(),
    stroke: jest.fn().mockReturnThis(),
    strokeColor: jest.fn().mockReturnThis(),
    fillColor: jest.fn().mockReturnThis(),
    addPage: jest.fn(function () { this.y = 50; return this; }),
    end: jest.fn(() => {
      if (handlers.data) handlers.data(Buffer.from('pdf'));
      if (handlers.end) handlers.end();
    }),
    y: 50,
    page: { width: 612, height: 792 }
  };
};

describe('department meeting email controller', () => {
  let controller;
  let mockDoc;
  let mockMeeting;
  let memberships;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDoc = createMockDoc();
    PDFDocument.mockImplementation(() => mockDoc);

    mockMeeting = {
      id: 12,
      title: 'Finance Committee Review',
      meeting_date: '2026-04-05T00:00:00.000Z',
      location: 'Conference Room',
      purpose: 'Review quarterly finance status',
      agenda: 'Budget review',
      minutes: 'Discussed current quarter results.',
      attendees: [1],
      tasks: [
        {
          title: 'Finalize revised budget',
          status: 'pending',
          priority: 'high',
          description: 'Prepare updated budget draft.',
          assignee: { first_name: 'Martha', last_name: 'Tsegai' }
        }
      ],
      department: {
        id: 4,
        name: 'Finance Committee'
      }
    };

    memberships = [
      {
        member: { id: 1, first_name: 'Dawit', last_name: 'Yifter', email: 'dawit@example.com' }
      },
      {
        member: { id: 2, first_name: 'Selam', last_name: 'Tesfay', email: '' }
      },
      {
        member: { id: 3, first_name: 'Rahel', last_name: 'Gebre', email: 'bad-email' }
      }
    ];

    models.DepartmentMeeting.findOne.mockResolvedValue(mockMeeting);
    models.DepartmentMember.findAll.mockResolvedValue(memberships);
    controller = require('../../controllers/departmentController');
  });

  it('builds email preview with valid recipients and skipped members', async () => {
    const req = { params: { departmentId: '4', meetingId: '12' } };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await controller.getMeetingEmailPreview(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        recipientCount: 1,
        skippedCount: 2,
        subject: 'Meeting Minute - Finance Committee Review'
      })
    }));
  });

  it('emails only members with valid addresses', async () => {
    const req = {
      params: { departmentId: '4', meetingId: '12' },
      body: {},
      user: { id: 9, role: 'admin' }
    };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await controller.emailMeetingMinutes(req, res);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'dawit@example.com',
      subject: 'Meeting Minute - Finance Committee Review',
      attachments: expect.arrayContaining([
        expect.objectContaining({ filename: expect.stringContaining('Meeting_Minute_') })
      ])
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        sentCount: 1,
        skippedCount: 2
      })
    }));
  });
});
