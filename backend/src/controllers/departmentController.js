'use strict';

const path = require('path');
const PDFDocument = require('pdfkit');
const { Department, DepartmentMember, Member, sequelize } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { sendEmail } = require('../services/emailService');
const { logActivity } = require('../utils/activityLogger');

const LOGO_PATH = path.join(__dirname, '../assets/church-logo.png');
const ETHIOPIC_FONT_REGULAR_PATH = path.join(__dirname, '../assets/fonts/NotoSansEthiopic-Regular.ttf');
const ETHIOPIC_FONT_BOLD_PATH = path.join(__dirname, '../assets/fonts/NotoSansEthiopic-Bold.ttf');
const LEADER_ROLES = ['leader', 'chairperson', 'chairman', 'co-leader', 'vice chairperson', 'vice chairman', 'head'];
const VALID_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const ETHIOPIC_CHAR_REGEX = /[\u1200-\u137F]/;

const formatMeetingDate = (value) => new Date(value).toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

function buildMeetingEmailSubject(meeting) {
  return `Meeting Minute - ${meeting.title}`;
}

function buildMeetingEmailBody({ meeting, department }) {
  return `Attached are the meeting minutes for "${meeting.title}"${department?.name ? ` from the ${department.name} department` : ''}. Please review the meeting notes and action items.`;
}

function sanitizeFilenamePart(value) {
  return String(value || '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function containsEthiopic(value) {
  return ETHIOPIC_CHAR_REGEX.test(String(value || ''));
}

function normalizePdfText(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[•●◦▪■]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-');
}

async function fetchMeetingEmailContext(departmentId, meetingId) {
  const { DepartmentMeeting, DepartmentTask } = require('../models');

  const meeting = await DepartmentMeeting.findOne({
    where: {
      id: meetingId,
      department_id: departmentId
    },
    include: [
      {
        model: Department,
        as: 'department',
        attributes: ['id', 'name', 'leader_id']
      },
      {
        model: Member,
        as: 'creator',
        attributes: ['id', 'first_name', 'last_name']
      },
      {
        model: DepartmentTask,
        as: 'tasks',
        include: [
          {
            model: Member,
            as: 'assignee',
            attributes: ['id', 'first_name', 'last_name', 'email']
          }
        ]
      }
    ],
    order: [[{ model: DepartmentTask, as: 'tasks' }, 'created_at', 'DESC']]
  });

  if (!meeting) {
    const error = new Error('Meeting not found');
    error.status = 404;
    throw error;
  }

  const memberships = await DepartmentMember.findAll({
    where: {
      department_id: departmentId,
      status: 'active'
    },
    include: [{
      model: Member,
      as: 'member',
      attributes: ['id', 'first_name', 'last_name', 'email']
    }],
    order: [
      ['role_in_department', 'ASC'],
      ['joined_at', 'ASC']
    ]
  });

  return {
    meeting,
    department: meeting.department,
    memberships
  };
}

function splitEmailRecipients(memberships) {
  const recipients = [];
  const skipped = [];

  memberships.forEach((membership) => {
    const member = membership.member;
    if (!member) return;

    const email = String(member.email || '').trim();
    const fullName = `${member.first_name} ${member.last_name}`.trim();

    if (!email) {
      skipped.push({
        id: member.id,
        name: fullName,
        reason: 'missing_email'
      });
      return;
    }

    if (!VALID_EMAIL_REGEX.test(email)) {
      skipped.push({
        id: member.id,
        name: fullName,
        email,
        reason: 'invalid_email'
      });
      return;
    }

    recipients.push({
      id: member.id,
      name: fullName,
      email
    });
  });

  return { recipients, skipped };
}

function buildMeetingMinutesPdfBuffer({ meeting, department, attendeeMembers }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;
    const bottomLimit = pageHeight - margin - 40;
    const fonts = {
      latinRegular: 'Helvetica',
      latinBold: 'Helvetica-Bold',
      ethiopicRegular: 'EthiopicRegular',
      ethiopicBold: 'EthiopicBold'
    };

    doc.registerFont(fonts.ethiopicRegular, ETHIOPIC_FONT_REGULAR_PATH);
    doc.registerFont(fonts.ethiopicBold, ETHIOPIC_FONT_BOLD_PATH);

    const pickFont = (text, weight = 'regular') => {
      const normalizedText = normalizePdfText(text);
      if (containsEthiopic(normalizedText)) {
        return weight === 'bold' ? fonts.ethiopicBold : fonts.ethiopicRegular;
      }
      return weight === 'bold' ? fonts.latinBold : fonts.latinRegular;
    };

    const setFontForText = (text, weight = 'regular') => doc.font(pickFont(text, weight));
    const splitMixedRuns = (text) => normalizePdfText(text).match(/[\u1200-\u137F]+|[^\u1200-\u137F]+/g) || [''];
    const writeMixedText = (text, options = {}, weight = 'regular') => {
      const normalizedText = normalizePdfText(text);
      const lines = normalizedText.split('\n');

      lines.forEach((line, lineIndex) => {
        const runs = splitMixedRuns(line);
        if (runs.length === 0) {
          doc.text('', options);
          return;
        }

        runs.forEach((run, runIndex) => {
          const isLastRun = runIndex === runs.length - 1;
          const isOnlyRun = runs.length === 1;
          const runOptions = runIndex === 0
            ? { ...options, continued: !isLastRun }
            : { continued: !isLastRun };

          doc.font(pickFont(run, weight)).text(run, runOptions);

          if (isOnlyRun && !isLastRun) {
            doc.text('', { continued: false });
          }
        });

        if (lineIndex < lines.length - 1) {
          doc.text('', { continued: false });
        }
      });
    };

    const ensureSpace = (needed = 80) => {
      if (doc.y + needed > bottomLimit) {
        doc.addPage();
      }
    };

    const sectionTitle = (title) => {
      ensureSpace(40);
      doc.moveDown(0.5);
      doc.fontSize(13).fillColor('#111827');
      writeMixedText(title, { width: contentWidth }, 'bold');
      doc.moveDown(0.2);
      doc.moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).lineWidth(1).strokeColor('#D1D5DB').stroke();
      doc.moveDown(0.5);
    };

    const labelValue = (label, value) => {
      const normalizedValue = normalizePdfText(value || 'Not provided');
      ensureSpace(24);
      doc.font(fonts.latinBold).fontSize(10).fillColor('#111827').text(`${label}: `, { continued: true });
      doc.fontSize(10).fillColor('#111827');
      writeMixedText(normalizedValue);
    };

    try { doc.image(LOGO_PATH, margin, margin, { width: 54 }); } catch (_) { }

    const headerX = margin + 68;
    let y = margin;
    doc.font(fonts.latinBold).fontSize(13).fillColor('#111827')
      .text('DEBRE TSEHAY ABUNE AREGAWI', headerX, y, { width: contentWidth - 68 });
    y += 17;
    doc.text('ORTHODOX TEWAHEDO CHURCH', headerX, y, { width: contentWidth - 68 });
    y += 15;
    doc.font(fonts.latinRegular).fontSize(9).fillColor('#4B5563')
      .text('1621 S Jupiter Rd, Garland, TX 75042', headerX, y, { width: contentWidth - 68 });
    y += 13;
    doc.text('Phone: (469) 436-3356  |  Email: abune.aregawi.dev@gmail.com', headerX, y, { width: contentWidth - 68 });
    y += 18;

    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(1.5).strokeColor('#111827').stroke();
    doc.y = y + 18;

    const meetingTitle = normalizePdfText(meeting.title);
    doc.fontSize(18).fillColor('#111827');
    writeMixedText(meetingTitle, { width: contentWidth, align: 'center' }, 'bold');
    if (meeting.title_ti) {
      const meetingTitleTi = normalizePdfText(meeting.title_ti);
      doc.moveDown(0.2);
      doc.fontSize(12).fillColor('#4B5563');
      writeMixedText(meetingTitleTi, { width: contentWidth, align: 'center' });
    }
    doc.moveDown(0.6);
    doc.font(fonts.latinRegular).fontSize(10).fillColor('#4B5563').text('Meeting Record', { width: contentWidth, align: 'center' });
    doc.moveDown(1);

    sectionTitle('Meeting Overview');
    labelValue('Department', department?.name || 'Not provided');
    labelValue('Date', formatMeetingDate(meeting.meeting_date));
    labelValue('Location', meeting.location || 'Not provided');
    labelValue('Purpose', meeting.purpose || meeting.purpose_ti || 'Not provided');

    if (meeting.purpose_ti && meeting.purpose) {
      const purposeTi = normalizePdfText(meeting.purpose_ti);
      doc.moveDown(0.25);
      doc.font(fonts.latinBold).fontSize(10).fillColor('#111827').text('Purpose (Tigrinya)');
      doc.fontSize(10).fillColor('#374151');
      writeMixedText(purposeTi, { width: contentWidth });
    }

    if (meeting.agenda || meeting.agenda_ti) {
      sectionTitle('Agenda');
      if (meeting.agenda) {
        const agenda = normalizePdfText(meeting.agenda);
        doc.font(fonts.latinBold).fontSize(10).fillColor('#111827').text('English');
        doc.fontSize(10).fillColor('#374151');
        writeMixedText(agenda, { width: contentWidth });
        doc.moveDown(0.5);
      }
      if (meeting.agenda_ti) {
        const agendaTi = normalizePdfText(meeting.agenda_ti);
        doc.font(fonts.latinBold).fontSize(10).fillColor('#111827').text('Tigrinya');
        doc.fontSize(10).fillColor('#374151');
        writeMixedText(agendaTi, { width: contentWidth });
      }
    }

    if (meeting.minutes || meeting.minutes_ti) {
      sectionTitle('Meeting Notes');
      if (meeting.minutes) {
        const minutes = normalizePdfText(meeting.minutes);
        doc.font(fonts.latinBold).fontSize(10).fillColor('#111827').text('English');
        doc.fontSize(10).fillColor('#374151');
        writeMixedText(minutes, { width: contentWidth });
        doc.moveDown(0.5);
      }
      if (meeting.minutes_ti) {
        const minutesTi = normalizePdfText(meeting.minutes_ti);
        doc.font(fonts.latinBold).fontSize(10).fillColor('#111827').text('Tigrinya');
        doc.fontSize(10).fillColor('#374151');
        writeMixedText(minutesTi, { width: contentWidth });
      }
    }

    sectionTitle('Action Items');
    if (meeting.tasks && meeting.tasks.length > 0) {
      meeting.tasks.forEach((task, index) => {
        ensureSpace(56);
        const taskTitle = normalizePdfText(task.title);
        doc.fontSize(10).fillColor('#111827');
        writeMixedText(`${index + 1}. ${taskTitle}`, { width: contentWidth }, 'bold');
        const details = [
          `Status: ${String(task.status || '').replace(/_/g, ' ') || 'pending'}`,
          `Priority: ${task.priority || 'medium'}`,
          task.assignee ? `Assigned to: ${task.assignee.first_name} ${task.assignee.last_name}` : null,
          task.end_date ? `Due: ${new Date(task.end_date).toLocaleDateString('en-US')}` : null
        ].filter(Boolean).map((detail) => normalizePdfText(detail));
        doc.font(fonts.latinRegular).fontSize(9).fillColor('#4B5563').text(details.join(' | '), { width: contentWidth });
        if (task.description) {
          const taskDescription = normalizePdfText(task.description);
          doc.moveDown(0.15);
          doc.fontSize(10).fillColor('#374151');
          writeMixedText(taskDescription, { width: contentWidth });
        }
        doc.moveDown(0.5);
      });
    } else {
      doc.font(fonts.latinRegular).fontSize(10).fillColor('#6B7280').text('No action items were recorded for this meeting.', { width: contentWidth });
    }

    sectionTitle('Attendees');
    if (attendeeMembers.length > 0) {
      attendeeMembers.forEach((member, index) => {
        ensureSpace(18);
        const attendeeLabel = normalizePdfText(`${index + 1}. ${member.first_name} ${member.last_name}`);
        doc.fontSize(10).fillColor('#374151');
        writeMixedText(attendeeLabel, { width: contentWidth });
      });
    } else {
      doc.font(fonts.latinRegular).fontSize(10).fillColor('#6B7280').text('No attendees were recorded for this meeting.', { width: contentWidth });
    }

    doc.moveDown(1.2);
    doc.font(fonts.latinRegular).fontSize(9).fillColor('#6B7280')
      .text(`Generated on ${new Date().toLocaleDateString('en-US')} | https://abunearegawi.church`, {
        width: contentWidth,
        align: 'center'
      });

    doc.end();
  });
}

// Get board members (Department ID 2)
exports.getBoardMembers = async (req, res) => {
  try {
    const query = `
      SELECT member_id, first_name, last_name, email, phone_number, role_in_department 
      FROM public.department_members d, public.members m 
      WHERE d.department_id = 2 AND m.id = d.member_id;
    `;

    const members = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: members
    });
  } catch (error) {
    logger.error('Get board members error', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch board members',
      error: error.message
    });
  }
};

// Get all departments with optional filters
exports.getAllDepartments = async (req, res) => {
  try {
    logger.debug('getAllDepartments called', {
      query: req.query,
      user: logger.safeSummary(req.user)
    });

    const {
      type,
      is_active,
      search,
      include_members,
      page = 1,
      limit = 50
    } = req.query;

    const where = {};

    // Filter by type
    if (type) {
      where.type = type;
    }

    // Filter by active status
    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    }

    // Search by name or description
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const include = [
      {
        model: Member,
        as: 'leader',
        attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
      },
      {
        model: Department,
        as: 'subDepartments',
        attributes: ['id', 'name', 'type', 'is_active']
      }
    ];

    // Optionally include member count
    if (include_members === 'true') {
      include.push({
        model: DepartmentMember,
        as: 'memberships',
        attributes: ['id', 'member_id', 'role_in_department', 'status'],
        where: { status: 'active' },
        required: false,
        include: [{
          model: Member,
          as: 'member',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
        }]
      });
    }

    const { count, rows: departments } = await Department.findAndCountAll({
      where,
      include,
      limit: parseInt(limit),
      offset,
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
      distinct: true
    });

    // Add member count to each department
    const departmentsWithCounts = departments.map(dept => {
      const deptData = dept.toJSON();
      deptData.member_count = deptData.memberships ? deptData.memberships.length : 0;
      return deptData;
    });

    logger.info('Departments fetched successfully', {
      totalCount: count,
      returnedCount: departmentsWithCounts.length,
      filters: { type, is_active, search, include_members }
    });

    res.json({
      success: true,
      data: {
        departments: departmentsWithCounts,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get all departments error', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch departments',
      error: error.message
    });
  }
};

// Get single department by ID
exports.getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findByPk(id, {
      include: [
        {
          model: Member,
          as: 'leader',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
        },
        {
          model: Department,
          as: 'parentDepartment',
          attributes: ['id', 'name', 'type']
        },
        {
          model: Department,
          as: 'subDepartments',
          attributes: ['id', 'name', 'type', 'is_active']
        },
        {
          model: DepartmentMember,
          as: 'memberships',
          where: { status: 'active' },
          required: false,
          include: [{
            model: Member,
            as: 'member',
            attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
          }]
        }
      ]
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    const deptData = department.toJSON();
    deptData.member_count = deptData.memberships ? deptData.memberships.length : 0;

    res.json({
      success: true,
      data: { department: deptData }
    });
  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department',
      error: error.message
    });
  }
};

// Create new department
exports.createDepartment = async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      parent_department_id,
      leader_id,
      contact_email,
      contact_phone,
      meeting_schedule,
      is_public,
      max_members,
      sort_order
    } = req.body;

    // Validate required fields
    if (!name || !type) {
      return res.status(400).json({
        success: false,
        message: 'Name and type are required'
      });
    }

    // Validate type
    const validTypes = ['ministry', 'committee', 'service', 'social', 'administrative'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // If leader_id is provided, verify the member exists
    if (leader_id) {
      const leader = await Member.findByPk(leader_id);
      if (!leader) {
        return res.status(404).json({
          success: false,
          message: 'Leader not found'
        });
      }
    }

    // If parent_department_id is provided, verify it exists
    if (parent_department_id) {
      const parentDept = await Department.findByPk(parent_department_id);
      if (!parentDept) {
        return res.status(404).json({
          success: false,
          message: 'Parent department not found'
        });
      }
    }

    // Sanitize empty strings to null for optional fields
    const sanitizedData = {
      name,
      description: description || null,
      type,
      parent_department_id: parent_department_id || null,
      leader_id: leader_id || null,
      contact_email: contact_email && contact_email.trim() !== '' ? contact_email : null,
      contact_phone: contact_phone && contact_phone.trim() !== '' ? contact_phone : null,
      meeting_schedule: meeting_schedule || null,
      is_active: true,
      is_public: is_public !== undefined ? is_public : true,
      max_members: max_members || null,
      sort_order: sort_order || 0
    };

    const department = await Department.create(sanitizedData);

    // If leader_id is provided, automatically add them as a member with leader role
    if (leader_id) {
      await DepartmentMember.create({
        department_id: department.id,
        member_id: leader_id,
        role_in_department: 'leader',
        status: 'active'
      });
    }

    // Fetch the created department with associations
    const createdDepartment = await Department.findByPk(department.id, {
      include: [
        {
          model: Member,
          as: 'leader',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: { department: createdDepartment }
    });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create department',
      error: error.message
    });
  }
};

// Update department
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const department = await Department.findByPk(id);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Validate type if being updated
    if (updates.type) {
      const validTypes = ['ministry', 'committee', 'service', 'social', 'administrative'];
      if (!validTypes.includes(updates.type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid type. Must be one of: ${validTypes.join(', ')}`
        });
      }
    }

    // If updating leader_id, verify the member exists
    if (updates.leader_id) {
      const leader = await Member.findByPk(updates.leader_id);
      if (!leader) {
        return res.status(404).json({
          success: false,
          message: 'Leader not found'
        });
      }

      // Add new leader as a member if not already
      const existingMembership = await DepartmentMember.findOne({
        where: {
          department_id: id,
          member_id: updates.leader_id
        }
      });

      if (!existingMembership) {
        await DepartmentMember.create({
          department_id: id,
          member_id: updates.leader_id,
          role_in_department: 'leader',
          status: 'active'
        });
      } else {
        // Update their role to leader
        await existingMembership.update({ role_in_department: 'leader' });
      }
    }

    // Sanitize empty strings to null for optional fields
    const sanitizedUpdates = { ...updates };
    if (sanitizedUpdates.contact_email !== undefined) {
      sanitizedUpdates.contact_email = sanitizedUpdates.contact_email && sanitizedUpdates.contact_email.trim() !== ''
        ? sanitizedUpdates.contact_email
        : null;
    }
    if (sanitizedUpdates.contact_phone !== undefined) {
      sanitizedUpdates.contact_phone = sanitizedUpdates.contact_phone && sanitizedUpdates.contact_phone.trim() !== ''
        ? sanitizedUpdates.contact_phone
        : null;
    }
    if (sanitizedUpdates.description !== undefined && !sanitizedUpdates.description) {
      sanitizedUpdates.description = null;
    }
    if (sanitizedUpdates.meeting_schedule !== undefined && !sanitizedUpdates.meeting_schedule) {
      sanitizedUpdates.meeting_schedule = null;
    }

    await department.update(sanitizedUpdates);

    // Fetch updated department with associations
    const updatedDepartment = await Department.findByPk(id, {
      include: [
        {
          model: Member,
          as: 'leader',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ]
    });

    res.json({
      success: true,
      message: 'Department updated successfully',
      data: { department: updatedDepartment }
    });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update department',
      error: error.message
    });
  }
};

// Delete (deactivate) department
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { hard_delete } = req.query;

    const department = await Department.findByPk(id);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    if (hard_delete === 'true') {
      // Hard delete - remove from database
      await department.destroy();
      res.json({
        success: true,
        message: 'Department deleted permanently'
      });
    } else {
      // Soft delete - just deactivate
      await department.update({ is_active: false });
      res.json({
        success: true,
        message: 'Department deactivated successfully'
      });
    }
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete department',
      error: error.message
    });
  }
};

// Get department statistics
exports.getDepartmentStats = async (req, res) => {
  try {
    const stats = await Department.findAll({
      attributes: [
        'type',
        [sequelize.fn('COUNT', sequelize.col('Department.id')), 'count']
      ],
      where: { is_active: true },
      group: ['type']
    });

    const totalDepartments = await Department.count({ where: { is_active: true } });

    const totalMembers = await DepartmentMember.count({
      where: { status: 'active' },
      distinct: true,
      col: 'member_id'
    });

    const departmentsByType = stats.reduce((acc, stat) => {
      acc[stat.type] = parseInt(stat.get('count'));
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        total_departments: totalDepartments,
        total_unique_members: totalMembers,
        by_type: departmentsByType
      }
    });
  } catch (error) {
    console.error('Get department stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department statistics',
      error: error.message
    });
  }
};

// ========== MEETING ENDPOINTS ==========

// Get meetings for a department
exports.getDepartmentMeetings = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    const { DepartmentMeeting, DepartmentTask } = require('../models');

    const meetings = await DepartmentMeeting.findAll({
      where: { department_id: id },
      include: [
        {
          model: Member,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: DepartmentTask,
          as: 'tasks',
          required: false
        }
      ],
      order: [['meeting_date', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: { meetings }
    });
  } catch (error) {
    console.error('Error fetching department meetings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch meetings',
      error: error.message
    });
  }
};

// Create a new meeting
exports.createMeeting = async (req, res) => {
  try {
    const { department_id, title, meeting_date, location, purpose, agenda, attendees, minutes,
      title_ti, purpose_ti, agenda_ti, minutes_ti } = req.body;
    const created_by = req.user?.member_id;

    const { DepartmentMeeting } = require('../models');

    if (!department_id || !title) {
      return res.status(400).json({
        success: false,
        message: 'Department ID and title are required'
      });
    }

    const meeting = await DepartmentMeeting.create({
      department_id,
      title,
      meeting_date: meeting_date || new Date(),
      location,
      purpose,
      agenda,
      attendees: attendees || [],
      minutes,
      title_ti,
      purpose_ti,
      agenda_ti,
      minutes_ti,
      created_by
    });

    res.status(201).json({
      success: true,
      data: { meeting }
    });
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create meeting',
      error: error.message
    });
  }
};

// Update a meeting
exports.updateMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const { DepartmentMeeting } = require('../models');

    const meeting = await DepartmentMeeting.findByPk(id);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    await meeting.update(updateData);

    res.json({
      success: true,
      data: { meeting }
    });
  } catch (error) {
    console.error('Error updating meeting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update meeting',
      error: error.message
    });
  }
};

// Get single meeting by ID with tasks and previous meeting
exports.getMeetingById = async (req, res) => {
  try {
    const { id } = req.params;

    const { DepartmentMeeting, DepartmentTask } = require('../models');

    // Fetch the meeting with tasks
    const meeting = await DepartmentMeeting.findByPk(id, {
      include: [
        {
          model: Member,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: DepartmentTask,
          as: 'tasks',
          include: [
            {
              model: Member,
              as: 'assignee',
              attributes: ['id', 'first_name', 'last_name']
            },
            {
              model: Member,
              as: 'creator',
              attributes: ['id', 'first_name', 'last_name']
            }
          ],
          order: [['created_at', 'DESC']]
        }
      ]
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Find previous meeting (by date, same department)
    const previousMeeting = await DepartmentMeeting.findOne({
      where: {
        department_id: meeting.department_id,
        meeting_date: {
          [Op.lt]: meeting.meeting_date
        }
      },
      include: [
        {
          model: DepartmentTask,
          as: 'tasks',
          include: [
            {
              model: Member,
              as: 'assignee',
              attributes: ['id', 'first_name', 'last_name']
            }
          ]
        }
      ],
      order: [['meeting_date', 'DESC']],
      limit: 1
    });

    res.json({
      success: true,
      data: {
        meeting,
        previousMeeting: previousMeeting || null
      }
    });
  } catch (error) {
    console.error('Error fetching meeting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch meeting',
      error: error.message
    });
  }
};

exports.getMeetingEmailPreview = async (req, res) => {
  try {
    const { departmentId, meetingId } = req.params;
    const { meeting, department, memberships } = await fetchMeetingEmailContext(departmentId, meetingId);
    const { recipients, skipped } = splitEmailRecipients(memberships);

    res.json({
      success: true,
      data: {
        subject: buildMeetingEmailSubject(meeting),
        body: buildMeetingEmailBody({ meeting, department }),
        department: {
          id: department?.id,
          name: department?.name || ''
        },
        meeting: {
          id: meeting.id,
          title: meeting.title,
          meeting_date: meeting.meeting_date
        },
        recipients,
        skipped,
        recipientCount: recipients.length,
        skippedCount: skipped.length
      }
    });
  } catch (error) {
    console.error('Error building meeting email preview:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to build meeting email preview'
    });
  }
};

exports.emailMeetingMinutes = async (req, res) => {
  try {
    const { departmentId, meetingId } = req.params;
    const { subject, body } = req.body || {};
    const { meeting, department, memberships } = await fetchMeetingEmailContext(departmentId, meetingId);
    const { recipients, skipped } = splitEmailRecipients(memberships);

    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active department members have a valid email address.',
        data: {
          recipients: [],
          skipped,
          recipientCount: 0,
          skippedCount: skipped.length
        }
      });
    }

    const attendeeIdSet = new Set(Array.isArray(meeting.attendees) ? meeting.attendees.map((value) => Number(value)) : []);
    const attendeeMembers = memberships
      .map((membership) => membership.member)
      .filter((member) => member && attendeeIdSet.has(Number(member.id)));

    const pdfBuffer = await buildMeetingMinutesPdfBuffer({ meeting, department, attendeeMembers });
    const emailSubject = String(subject || buildMeetingEmailSubject(meeting)).trim();
    const emailBody = String(body || buildMeetingEmailBody({ meeting, department })).trim();
    const filenameBase = sanitizeFilenamePart(meeting.title) || `meeting_${meeting.id}`;
    const attachment = {
      filename: `Meeting_Minute_${filenameBase}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    };

    const sent = [];
    const failed = [];

    for (const recipient of recipients) {
      try {
        await sendEmail({
          to: recipient.email,
          subject: emailSubject,
          text: emailBody,
          attachments: [attachment]
        });
        sent.push(recipient);
      } catch (sendError) {
        failed.push({
          ...recipient,
          error: sendError.message || 'Failed to send email'
        });
      }
    }

    logActivity({
      userId: req.user?.id || req.user?.member_id,
      action: 'EMAIL_MEETING_MINUTES',
      entityType: 'DepartmentMeeting',
      entityId: String(meeting.id),
      details: {
        departmentId: department?.id || departmentId,
        recipientCount: sent.length,
        failedCount: failed.length,
        skippedCount: skipped.length
      },
      req
    });

    if (sent.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send meeting minutes email.',
        data: {
          sent,
          failed,
          skipped,
          recipientCount: recipients.length,
          skippedCount: skipped.length
        }
      });
    }

    res.json({
      success: true,
      message: failed.length > 0
        ? `Meeting minutes emailed to ${sent.length} member(s). ${failed.length} delivery attempt(s) failed.`
        : `Meeting minutes emailed to ${sent.length} member(s).`,
      data: {
        sent,
        failed,
        skipped,
        recipientCount: recipients.length,
        skippedCount: skipped.length,
        sentCount: sent.length,
        failedCount: failed.length
      }
    });
  } catch (error) {
    console.error('Error emailing meeting minutes:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to email meeting minutes'
    });
  }
};

// Delete a meeting
exports.deleteMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    const { DepartmentMeeting } = require('../models');

    const meeting = await DepartmentMeeting.findByPk(id);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    await meeting.destroy();

    res.json({
      success: true,
      message: 'Meeting deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting meeting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete meeting',
      error: error.message
    });
  }
};

// ========== TASK ENDPOINTS ==========

// Get tasks for a department
exports.getDepartmentTasks = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assigned_to } = req.query;

    const { DepartmentTask, DepartmentMeeting } = require('../models');

    const whereClause = { department_id: id };
    if (status) whereClause.status = status;
    if (assigned_to) whereClause.assigned_to = assigned_to;

    const tasks = await DepartmentTask.findAll({
      where: whereClause,
      include: [
        {
          model: Member,
          as: 'assignee',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Member,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: DepartmentMeeting,
          as: 'meeting',
          attributes: ['id', 'title', 'meeting_date'],
          required: false
        }
      ],
      order: [
        ['status', 'ASC'],
        ['priority', 'DESC'],
        ['due_date', 'ASC']
      ]
    });

    res.json({
      success: true,
      data: { tasks }
    });
  } catch (error) {
    console.error('Error fetching department tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: error.message
    });
  }
};

// Create a new task
exports.createTask = async (req, res) => {
  try {
    const {
      department_id,
      meeting_id,
      title,
      description,
      assigned_to,
      status,
      priority,
      due_date,
      start_date,
      end_date,
      rejected_date,
      notes
    } = req.body;
    const created_by = req.user?.member_id;

    const { DepartmentTask } = require('../models');

    if (!department_id || !title) {
      return res.status(400).json({
        success: false,
        message: 'Department ID and title are required'
      });
    }

    // Validate rejected_date is provided when status is 'rejected'
    if (status === 'rejected' && !rejected_date) {
      return res.status(400).json({
        success: false,
        message: 'Rejected date is required when status is rejected'
      });
    }

    const task = await DepartmentTask.create({
      department_id,
      meeting_id,
      title,
      description,
      assigned_to,
      status: status || 'pending',
      priority: priority || 'medium',
      due_date,
      start_date,
      end_date,
      rejected_date,
      notes,
      created_by
    });

    res.status(201).json({
      success: true,
      data: { task }
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create task',
      error: error.message
    });
  }
};

// Update a task
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const { DepartmentTask } = require('../models');

    const task = await DepartmentTask.findByPk(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Validate rejected_date is provided when status is being changed to 'rejected'
    if (updateData.status === 'rejected' && !updateData.rejected_date && !task.rejected_date) {
      return res.status(400).json({
        success: false,
        message: 'Rejected date is required when status is rejected'
      });
    }

    await task.update(updateData);

    res.json({
      success: true,
      data: { task }
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task',
      error: error.message
    });
  }
};

// Delete a task
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const { DepartmentTask } = require('../models');

    const task = await DepartmentTask.findByPk(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    await task.destroy();

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete task',
      error: error.message
    });
  }
};

// Get departments for a specific member
exports.getMemberDepartments = async (req, res) => {
  try {
    const { member_id } = req.params;

    const memberships = await DepartmentMember.findAll({
      where: { member_id, status: 'active' },
      include: [
        {
          model: Department,
          as: 'department',
          include: [
            {
              model: Member,
              as: 'leader',
              attributes: ['id', 'first_name', 'last_name']
            }
          ]
        }
      ]
    });

    const departments = memberships.map(m => ({
      ...m.department.toJSON(),
      role: m.role_in_department,
      joined_at: m.joined_at
    }));

    res.json({
      success: true,
      data: { departments }
    });
  } catch (error) {
    console.error('Error fetching member departments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member departments',
      error: error.message
    });
  }
};

module.exports = exports;
