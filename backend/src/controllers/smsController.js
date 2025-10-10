'use strict';

const { Member, Group, MemberGroup, SmsLog, Department, DepartmentMember } = require('../models');
const { sendSms, sendSmsBatch } = require('../services/twilioService');

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
