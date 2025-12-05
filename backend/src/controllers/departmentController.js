'use strict';

const { Department, DepartmentMember, Member, sequelize } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

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
    const { department_id, title, meeting_date, location, purpose, agenda, attendees, minutes } = req.body;
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
