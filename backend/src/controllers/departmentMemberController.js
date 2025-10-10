'use strict';

const { Department, DepartmentMember, Member } = require('../models');
const { Op } = require('sequelize');

// Get all members of a department
exports.getDepartmentMembers = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { status = 'active', role } = req.query;

    const department = await Department.findByPk(departmentId);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    const where = { department_id: departmentId };
    
    if (status) {
      where.status = status;
    }

    if (role) {
      where.role_in_department = role;
    }

    const memberships = await DepartmentMember.findAll({
      where,
      include: [{
        model: Member,
        as: 'member',
        attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number', 'date_joined_parish']
      }],
      order: [
        ['role_in_department', 'ASC'],
        ['joined_at', 'ASC']
      ]
    });

    res.json({
      success: true,
      data: {
        department,
        members: memberships,
        count: memberships.length
      }
    });
  } catch (error) {
    console.error('Get department members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department members',
      error: error.message
    });
  }
};

// Add members to department (bulk)
exports.addMembersToDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { member_ids, role_in_department = 'member', notes } = req.body;

    if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'member_ids array is required'
      });
    }

    const department = await Department.findByPk(departmentId);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Check if department has max_members limit
    if (department.max_members) {
      const currentCount = await DepartmentMember.count({
        where: {
          department_id: departmentId,
          status: 'active'
        }
      });

      if (currentCount + member_ids.length > department.max_members) {
        return res.status(400).json({
          success: false,
          message: `Department has reached maximum capacity of ${department.max_members} members`
        });
      }
    }

    const results = {
      added: [],
      already_exists: [],
      not_found: []
    };

    for (const member_id of member_ids) {
      // Check if member exists
      const member = await Member.findByPk(member_id);
      if (!member) {
        results.not_found.push(member_id);
        continue;
      }

      // Check if already in department
      const existing = await DepartmentMember.findOne({
        where: {
          department_id: departmentId,
          member_id
        }
      });

      if (existing) {
        results.already_exists.push({
          member_id,
          name: `${member.first_name} ${member.last_name}`
        });
        continue;
      }

      // Add member to department
      const membership = await DepartmentMember.create({
        department_id: departmentId,
        member_id,
        role_in_department,
        status: 'active',
        notes
      });

      results.added.push({
        member_id,
        name: `${member.first_name} ${member.last_name}`,
        role: role_in_department
      });
    }

    res.status(201).json({
      success: true,
      message: `Added ${results.added.length} member(s) to department`,
      data: results
    });
  } catch (error) {
    console.error('Add members to department error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add members to department',
      error: error.message
    });
  }
};

// Update department member (role, status, notes)
exports.updateDepartmentMember = async (req, res) => {
  try {
    const { departmentId, memberId } = req.params;
    const { role_in_department, status, notes } = req.body;

    const membership = await DepartmentMember.findOne({
      where: {
        department_id: departmentId,
        member_id: memberId
      }
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in this department'
      });
    }

    const updates = {};
    if (role_in_department) updates.role_in_department = role_in_department;
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    await membership.update(updates);

    // Fetch updated membership with member details
    const updatedMembership = await DepartmentMember.findOne({
      where: {
        department_id: departmentId,
        member_id: memberId
      },
      include: [{
        model: Member,
        as: 'member',
        attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
      }]
    });

    res.json({
      success: true,
      message: 'Department member updated successfully',
      data: { membership: updatedMembership }
    });
  } catch (error) {
    console.error('Update department member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update department member',
      error: error.message
    });
  }
};

// Remove member from department
exports.removeMemberFromDepartment = async (req, res) => {
  try {
    const { departmentId, memberId } = req.params;

    const membership = await DepartmentMember.findOne({
      where: {
        department_id: departmentId,
        member_id: memberId
      }
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in this department'
      });
    }

    await membership.destroy();

    res.json({
      success: true,
      message: 'Member removed from department successfully'
    });
  } catch (error) {
    console.error('Remove member from department error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove member from department',
      error: error.message
    });
  }
};

// Get all departments for a specific member
exports.getMemberDepartments = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { status = 'active' } = req.query;

    const member = await Member.findByPk(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const where = { member_id: memberId };
    if (status) {
      where.status = status;
    }

    const memberships = await DepartmentMember.findAll({
      where,
      include: [{
        model: Department,
        as: 'department',
        where: { is_active: true },
        required: true
      }],
      order: [['joined_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        member,
        departments: memberships,
        count: memberships.length
      }
    });
  } catch (error) {
    console.error('Get member departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member departments',
      error: error.message
    });
  }
};

module.exports = exports;
