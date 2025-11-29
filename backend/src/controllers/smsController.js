'use strict';

const { Member, Group, MemberGroup, SmsLog, Department, DepartmentMember, Pledge } = require('../models');
const { sendSms, sendSmsBatch } = require('../services/twilioService');
const tz = require('../config/timezone');

// Normalize phone numbers to E.164 if possible (basic handling)
function normalizePhone(phone) {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed;
  // Fallback: assume US if not prefixed; in production, store normalized in DB
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

// Template variable substitution for personalized messages
function substituteTemplateVariables(template, data) {
  if (!template) return template;
  
  let message = template;
  
  // Replace {firstName}, {lastName}, {fullName}
  if (data.firstName) {
    message = message.replace(/{firstName}/gi, data.firstName);
  }
  if (data.lastName) {
    message = message.replace(/{lastName}/gi, data.lastName);
  }
  if (data.firstName && data.lastName) {
    message = message.replace(/{fullName}/gi, `${data.firstName} ${data.lastName}`);
  }
  
  // Replace {amount} - format as currency
  if (data.amount !== undefined && data.amount !== null) {
    const formattedAmount = `$${parseFloat(data.amount).toFixed(2)}`;
    message = message.replace(/{amount}/gi, formattedAmount);
  }
  
  // Replace {totalAmount} - for multiple pledges
  if (data.totalAmount !== undefined && data.totalAmount !== null) {
    const formattedTotal = `$${parseFloat(data.totalAmount).toFixed(2)}`;
    message = message.replace(/{totalAmount}/gi, formattedTotal);
  }
  
  // Replace {pledgeCount}
  if (data.pledgeCount !== undefined && data.pledgeCount !== null) {
    message = message.replace(/{pledgeCount}/gi, data.pledgeCount.toString());
  }
  
  // Replace {dueDate} - format date nicely in CST
  if (data.dueDate) {
    const formatted = tz.formatForDisplay(data.dueDate, 'MMM DD, YYYY');
    message = message.replace(/{dueDate}/gi, formatted);
  }
  
  return message;
}

async function logSms({ sender_id, role, recipient_type, recipient_member_id = null, group_id = null, department_id = null, recipient_count, message, status, error = null }) {
  try {
    await SmsLog.create({ sender_id, role, recipient_type, recipient_member_id, group_id, department_id, recipient_count, message, status, error });
  } catch (e) {
    console.error('Failed to log SMS:', e.message);
  }
}

exports.sendIndividual = async (req, res) => {
  try {
    const senderId = req.user.id;
    const role = req.user.role;
    const { memberId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const member = await Member.findByPk(memberId);
    if (!member || !member.is_active) {
      await logSms({ sender_id: senderId, role, recipient_type: 'individual', recipient_member_id: memberId, recipient_count: 0, message, status: 'failed', error: 'Member not found or inactive' });
      return res.status(404).json({ success: false, message: 'Member not found or inactive' });
    }

    const to = normalizePhone(member.phone_number);
    try {
      const r = await sendSms(to, message);
      await logSms({ sender_id: senderId, role, recipient_type: 'individual', recipient_member_id: member.id, recipient_count: 1, message, status: 'success' });
      return res.json({ success: true, sid: r.sid });
    } catch (err) {
      await logSms({ sender_id: senderId, role, recipient_type: 'individual', recipient_member_id: member.id, recipient_count: 1, message, status: 'failed', error: err.message });
      return res.status(502).json({ success: false, message: 'Failed to send SMS', error: err.message });
    }
  } catch (error) {
    console.error('sendIndividual error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.sendGroup = async (req, res) => {
  try {
    const senderId = req.user.id;
    const role = req.user.role;
    const { groupId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const group = await Group.findByPk(groupId);
    if (!group || !group.is_active) {
      await logSms({ sender_id: senderId, role, recipient_type: 'group', group_id: groupId, recipient_count: 0, message, status: 'failed', error: 'Group not found or inactive' });
      return res.status(404).json({ success: false, message: 'Group not found or inactive' });
    }

    const memberships = await MemberGroup.findAll({ where: { group_id: groupId }, include: [{ model: Member, as: 'member' }] });
    const recipients = memberships
      .map(mg => mg.member)
      .filter(m => m && m.is_active && !!m.phone_number)
      .map(m => normalizePhone(m.phone_number));

    if (recipients.length === 0) {
      await logSms({ sender_id: senderId, role, recipient_type: 'group', group_id: groupId, recipient_count: 0, message, status: 'failed', error: 'No recipients in group' });
      return res.status(400).json({ success: false, message: 'No recipients in group' });
    }

    const results = await sendSmsBatch(recipients, message, { concurrency: 20, delayMsBetweenBatches: 1000 });
    const successCount = results.filter(r => r.success).length;

    let status = 'success';
    let error = null;
    if (successCount === 0) { status = 'failed'; error = 'All failed'; }
    else if (successCount < results.length) { status = 'partial'; error = `${results.length - successCount} failed`; }

    await logSms({ sender_id: senderId, role, recipient_type: 'group', group_id: groupId, recipient_count: recipients.length, message, status, error });

    return res.json({ success: successCount > 0, results, successCount, total: results.length });
  } catch (error) {
    console.error('sendGroup error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.sendAll = async (req, res) => {
  try {
    const senderId = req.user.id;
    const role = req.user.role;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const members = await Member.findAll({ where: { is_active: true } });
    const recipients = members
      .filter(m => !!m.phone_number)
      .map(m => normalizePhone(m.phone_number));

    if (recipients.length === 0) {
      await logSms({ sender_id: senderId, role, recipient_type: 'all', recipient_count: 0, message, status: 'failed', error: 'No active members with phone numbers' });
      return res.status(400).json({ success: false, message: 'No active members with phone numbers' });
    }

    const results = await sendSmsBatch(recipients, message, { concurrency: 20, delayMsBetweenBatches: 1000 });
    const successCount = results.filter(r => r.success).length;

    let status = 'success';
    let error = null;
    if (successCount === 0) { status = 'failed'; error = 'All failed'; }
    else if (successCount < results.length) { status = 'partial'; error = `${results.length - successCount} failed`; }

    await logSms({ sender_id: senderId, role, recipient_type: 'all', recipient_count: recipients.length, message, status, error });

    return res.json({ success: successCount > 0, results, successCount, total: results.length });
  } catch (error) {
    console.error('sendAll error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.sendDepartment = async (req, res) => {
  try {
    const senderId = req.user.id;
    const role = req.user.role;
    const { departmentId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const department = await Department.findByPk(departmentId);
    if (!department || !department.is_active) {
      await logSms({ sender_id: senderId, role, recipient_type: 'department', department_id: departmentId, recipient_count: 0, message, status: 'failed', error: 'Department not found or inactive' });
      return res.status(404).json({ success: false, message: 'Department not found or inactive' });
    }

    // Get all department members
    const memberships = await DepartmentMember.findAll({
      where: { 
        department_id: departmentId,
        status: 'active'
      },
      include: [{
        model: Member,
        as: 'member',
        where: { is_active: true }
      }]
    });

    const recipients = memberships
      .map(dm => dm.member)
      .filter(m => m && !!m.phone_number)
      .map(m => normalizePhone(m.phone_number));

    if (recipients.length === 0) {
      await logSms({ sender_id: senderId, role, recipient_type: 'department', department_id: departmentId, recipient_count: 0, message, status: 'failed', error: 'No recipients in department' });
      return res.status(400).json({ success: false, message: 'No recipients in department' });
    }

    const results = await sendSmsBatch(recipients, message, { concurrency: 20, delayMsBetweenBatches: 1000 });
    const successCount = results.filter(r => r.success).length;

    let status = 'success';
    let error = null;
    if (successCount === 0) { status = 'failed'; error = 'All failed'; }
    else if (successCount < results.length) { status = 'partial'; error = `${results.length - successCount} failed`; }

    await logSms({ sender_id: senderId, role, recipient_type: 'department', department_id: departmentId, recipient_count: recipients.length, message, status, error });

    return res.json({ success: successCount > 0, results, successCount, total: results.length, departmentName: department.name });
  } catch (error) {
    console.error('sendDepartment error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
// Add these two functions to the end of smsController.js

exports.sendPendingPledges = async (req, res) => {
  try {
    const senderId = req.user.id;
    const role = req.user.role;
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // Get all members with pending pledges
    const pendingPledges = await Pledge.findAll({
      where: { status: 'pending' },
      include: [{
        model: Member,
        as: 'member',
        attributes: ['id', 'first_name', 'last_name', 'phone_number'],
        where: { is_active: true }
      }],
      attributes: ['id', 'member_id', 'amount', 'due_date'],
      raw: false
    });

    // Get unique members with aggregated pledge data
    const memberMap = new Map();
    pendingPledges.forEach(pledge => {
      if (pledge.member && pledge.member.phone_number) {
        const memberId = pledge.member.id;
        if (!memberMap.has(memberId)) {
          memberMap.set(memberId, {
            member: pledge.member,
            pledges: [],
            totalAmount: 0
          });
        }
        const memberData = memberMap.get(memberId);
        memberData.pledges.push({
          amount: parseFloat(pledge.amount),
          dueDate: pledge.due_date
        });
        memberData.totalAmount += parseFloat(pledge.amount);
      }
    });

    const recipients = Array.from(memberMap.values());

    if (recipients.length === 0) {
      await logSms({ 
        sender_id: senderId, 
        role, 
        recipient_type: 'pending_pledges', 
        recipient_count: 0, 
        message, 
        status: 'failed', 
        error: 'No members with pending pledges found' 
      });
      return res.status(404).json({ success: false, message: 'No members with pending pledges found' });
    }

    // Send personalized SMS to all recipients with template substitution
    const batch = recipients.map(recipientData => {
      const { member, pledges, totalAmount } = recipientData;
      
      // Prepare template data
      const templateData = {
        firstName: member.first_name,
        lastName: member.last_name,
        amount: pledges.length === 1 ? pledges[0].amount : null,
        totalAmount: totalAmount,
        pledgeCount: pledges.length,
        dueDate: pledges.length === 1 ? pledges[0].dueDate : null
      };
      
      // Substitute template variables
      const personalizedMessage = substituteTemplateVariables(message, templateData);
      
      return {
        to: normalizePhone(member.phone_number),
        body: personalizedMessage,
        metadata: { 
          memberId: member.id, 
          firstName: member.first_name, 
          lastName: member.last_name,
          pledgeCount: pledges.length,
          totalAmount: totalAmount
        }
      };
    });

    const results = await sendSmsBatch(batch);
    const successCount = results.filter(r => r.success).length;

    let status = 'success';
    let error = null;
    if (successCount === 0) { status = 'failed'; error = 'All messages failed'; }
    else if (successCount < results.length) { status = 'partial'; error = `${results.length - successCount} failed`; }

    await logSms({ 
      sender_id: senderId, 
      role, 
      recipient_type: 'pending_pledges', 
      recipient_count: recipients.length, 
      message, 
      status, 
      error 
    });

    return res.json({ 
      success: successCount > 0, 
      results, 
      successCount, 
      total: results.length,
      pledgeStatus: 'pending'
    });
  } catch (error) {
    console.error('sendPendingPledges error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.sendFulfilledPledges = async (req, res) => {
  try {
    const senderId = req.user.id;
    const role = req.user.role;
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // Get all members with fulfilled pledges
    const fulfilledPledges = await Pledge.findAll({
      where: { status: 'fulfilled' },
      include: [{
        model: Member,
        as: 'member',
        attributes: ['id', 'first_name', 'last_name', 'phone_number'],
        where: { is_active: true }
      }],
      attributes: ['id', 'member_id', 'amount', 'fulfilled_date'],
      raw: false
    });

    // Get unique members with aggregated pledge data
    const memberMap = new Map();
    fulfilledPledges.forEach(pledge => {
      if (pledge.member && pledge.member.phone_number) {
        const memberId = pledge.member.id;
        if (!memberMap.has(memberId)) {
          memberMap.set(memberId, {
            member: pledge.member,
            pledges: [],
            totalAmount: 0
          });
        }
        const memberData = memberMap.get(memberId);
        memberData.pledges.push({
          amount: parseFloat(pledge.amount),
          fulfilledDate: pledge.fulfilled_date
        });
        memberData.totalAmount += parseFloat(pledge.amount);
      }
    });

    const recipients = Array.from(memberMap.values());

    if (recipients.length === 0) {
      await logSms({ 
        sender_id: senderId, 
        role, 
        recipient_type: 'fulfilled_pledges', 
        recipient_count: 0, 
        message, 
        status: 'failed', 
        error: 'No members with fulfilled pledges found' 
      });
      return res.status(404).json({ success: false, message: 'No members with fulfilled pledges found' });
    }

    // Send personalized SMS to all recipients with template substitution
    const batch = recipients.map(recipientData => {
      const { member, pledges, totalAmount } = recipientData;
      
      // Prepare template data
      const templateData = {
        firstName: member.first_name,
        lastName: member.last_name,
        amount: pledges.length === 1 ? pledges[0].amount : null,
        totalAmount: totalAmount,
        pledgeCount: pledges.length
      };
      
      // Substitute template variables
      const personalizedMessage = substituteTemplateVariables(message, templateData);
      
      return {
        to: normalizePhone(member.phone_number),
        body: personalizedMessage,
        metadata: { 
          memberId: member.id, 
          firstName: member.first_name, 
          lastName: member.last_name,
          pledgeCount: pledges.length,
          totalAmount: totalAmount
        }
      };
    });

    const results = await sendSmsBatch(batch);
    const successCount = results.filter(r => r.success).length;

    let status = 'success';
    let error = null;
    if (successCount === 0) { status = 'failed'; error = 'All messages failed'; }
    else if (successCount < results.length) { status = 'partial'; error = `${results.length - successCount} failed`; }

    await logSms({ 
      sender_id: senderId, 
      role, 
      recipient_type: 'fulfilled_pledges', 
      recipient_count: recipients.length, 
      message, 
      status, 
      error 
    });

    return res.json({ 
      success: successCount > 0, 
      results, 
      successCount, 
      total: results.length,
      pledgeStatus: 'fulfilled'
    });
  } catch (error) {
    console.error('sendFulfilledPledges error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get preview of members with pending pledges
exports.getPendingPledgesRecipients = async (req, res) => {
  try {
    // Get all members with pending pledges
    const pendingPledges = await Pledge.findAll({
      where: { status: 'pending' },
      include: [{
        model: Member,
        as: 'member',
        attributes: ['id', 'first_name', 'last_name', 'phone_number', 'email'],
        where: { is_active: true }
      }],
      attributes: ['id', 'member_id', 'amount', 'due_date', 'pledge_type'],
      raw: false
    });

    // Get unique members with their pledge info
    const memberMap = new Map();
    pendingPledges.forEach(pledge => {
      if (pledge.member && pledge.member.phone_number) {
        const memberId = pledge.member.id;
        if (!memberMap.has(memberId)) {
          memberMap.set(memberId, {
            id: pledge.member.id,
            firstName: pledge.member.first_name,
            lastName: pledge.member.last_name,
            phoneNumber: pledge.member.phone_number,
            email: pledge.member.email,
            pendingPledges: []
          });
        }
        memberMap.get(memberId).pendingPledges.push({
          amount: pledge.amount,
          dueDate: pledge.due_date,
          pledgeType: pledge.pledge_type
        });
      }
    });

    const recipients = Array.from(memberMap.values());

    return res.json({
      success: true,
      data: {
        recipients,
        totalCount: recipients.length,
        totalPledges: pendingPledges.length
      }
    });
  } catch (error) {
    console.error('getPendingPledgesRecipients error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get preview of department members
exports.getDepartmentRecipients = async (req, res) => {
  try {
    const { departmentId } = req.params;

    if (!departmentId) {
      return res.status(400).json({ success: false, message: 'Department ID is required' });
    }

    // Get department with its members
    const department = await Department.findByPk(departmentId, {
      include: [{
        model: DepartmentMember,
        as: 'memberships',
        where: { status: 'active' },
        required: false,
        include: [{
          model: Member,
          as: 'member',
          attributes: ['id', 'first_name', 'last_name', 'phone_number', 'email'],
          where: { is_active: true }
        }]
      }]
    });

    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    // Extract members with phone numbers
    const recipients = department.memberships
      .filter(membership => membership.member && membership.member.phone_number)
      .map(membership => ({
        id: membership.member.id,
        firstName: membership.member.first_name,
        lastName: membership.member.last_name,
        phoneNumber: membership.member.phone_number,
        email: membership.member.email,
        roleInDepartment: membership.role_in_department
      }));

    return res.json({
      success: true,
      data: {
        departmentName: department.name,
        departmentType: department.type,
        recipients,
        totalCount: recipients.length
      }
    });
  } catch (error) {
    console.error('getDepartmentRecipients error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get preview of members with fulfilled pledges
exports.getFulfilledPledgesRecipients = async (req, res) => {
  try {
    // Get all members with fulfilled pledges
    const fulfilledPledges = await Pledge.findAll({
      where: { status: 'fulfilled' },
      include: [{
        model: Member,
        as: 'member',
        attributes: ['id', 'first_name', 'last_name', 'phone_number', 'email'],
        where: { is_active: true }
      }],
      attributes: ['id', 'member_id', 'amount', 'fulfilled_date', 'pledge_type'],
      raw: false
    });

    // Get unique members with their pledge info
    const memberMap = new Map();
    fulfilledPledges.forEach(pledge => {
      if (pledge.member && pledge.member.phone_number) {
        const memberId = pledge.member.id;
        if (!memberMap.has(memberId)) {
          memberMap.set(memberId, {
            id: pledge.member.id,
            firstName: pledge.member.first_name,
            lastName: pledge.member.last_name,
            phoneNumber: pledge.member.phone_number,
            email: pledge.member.email,
            fulfilledPledges: []
          });
        }
        memberMap.get(memberId).fulfilledPledges.push({
          amount: pledge.amount,
          fulfilledDate: pledge.fulfilled_date,
          pledgeType: pledge.pledge_type
        });
      }
    });

    const recipients = Array.from(memberMap.values());

    return res.json({
      success: true,
      data: {
        recipients,
        totalCount: recipients.length,
        totalPledges: fulfilledPledges.length
      }
    });
  } catch (error) {
    console.error('getFulfilledPledgesRecipients error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
