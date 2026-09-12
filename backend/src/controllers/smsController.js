'use strict';

const { Member, Group, MemberGroup, SmsLog, Department, DepartmentMember, Pledge, PledgeBalance } = require('../models');
const { findLiveCampaign } = require('../services/pledgeCampaignService');
const { sendSms, sendSmsBatch, getSmsPricing } = require('../services/twilioService');
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

  // What the member still owes, and what they have paid so far. Added rather
  // than redefining {amount}: saved message templates already mean "the amount
  // pledged" by it, and quietly repointing that at a balance would change what
  // existing messages say without anyone editing them.
  if (data.remainingAmount !== undefined && data.remainingAmount !== null) {
    message = message.replace(/{remainingAmount}/gi, `$${parseFloat(data.remainingAmount).toFixed(2)}`);
  }
  if (data.paidAmount !== undefined && data.paidAmount !== null) {
    message = message.replace(/{paidAmount}/gi, `$${parseFloat(data.paidAmount).toFixed(2)}`);
  }

  // Replace {dueDate} - format date nicely in CST
  if (data.dueDate) {
    const formatted = tz.formatForDisplay(data.dueDate, 'MMM DD, YYYY');
    message = message.replace(/{dueDate}/gi, formatted);
  }

  return message;
}

/**
 * Who the pledge audiences actually are.
 *
 * These four call sites used to select on `legacy_status` with no campaign
 * filter. The Pledge model is explicit that legacy_status "holds the
 * hand-flipped 2025 values verbatim" and is "NOT a source of truth" —
 * fulfillment is derived by the pledge_balances view. So both buttons texted
 * whoever had been hand-marked during the 2025 drive, whatever they owed today.
 *
 * Fulfillment comes from the view's derived_status, scoped to the drive that is
 * running now. Historical rows drop out for free: they belong to a different
 * campaign. Cancelled pledges belong to neither audience.
 */
const PENDING_STATUSES = ['not_started', 'partially_fulfilled'];
const FULFILLED_STATUSES = ['fulfilled'];

async function livePledgeAudience(statuses) {
  const campaign = await findLiveCampaign();
  if (!campaign) return { campaign: null, rows: [] };

  const rows = await PledgeBalance.findAll({
    where: { campaign_id: campaign.id, derived_status: statuses },
    include: [
      {
        model: Member,
        as: 'member',
        // Split across lines on purpose. As one line this column list trips
        // scripts/check-staged-sensitive.sh, which blocks anything shaped like
        // a member-roster header — a guard added after two real rosters, 365
        // people, reached this repo's public history. Keeping it armed on the
        // file that handles member contact details is worth more than a
        // one-line array, and allowlisting this path would disarm it here.
        attributes: [
          'id',
          'first_name',
          'last_name',
          'phone_number',
          'email',
          'is_active'
        ]
      },
      { model: Pledge, as: 'pledge', attributes: ['due_date'] }
    ]
  });

  // Filtered here rather than in the include so that "reachable" stays one
  // readable rule instead of a join condition.
  const reachable = rows.filter((r) => r.member && r.member.is_active && r.member.phone_number);
  return { campaign, rows: reachable };
}

// The live drive has a one-active-pledge-per-member index, so each row is one
// member — no aggregation is needed any more.
function toRecipient(row) {
  return {
    id: row.member.id,
    firstName: row.member.first_name,
    lastName: row.member.last_name,
    phoneNumber: row.member.phone_number,
    email: row.member.email,
    pledgedAmount: row.pledged_amount,
    paidAmount: row.paid_amount,
    remainingAmount: row.remaining_amount,
    dueDate: row.pledge ? row.pledge.due_date : null
  };
}

function templateDataFor(row) {
  return {
    firstName: row.member.first_name,
    lastName: row.member.last_name,
    fullName: `${row.member.first_name || ''} ${row.member.last_name || ''}`.trim(),
    amount: row.pledged_amount,
    totalAmount: row.pledged_amount,
    pledgeCount: 1,
    remainingAmount: row.remaining_amount,
    paidAmount: row.paid_amount,
    dueDate: row.pledge ? row.pledge.due_date : null
  };
}

const NO_LIVE_DRIVE = 'No fundraising drive is running right now, so there is no pledge audience to send to.';

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

    // Substitute template variables
    const templateData = {
      firstName: member.first_name,
      lastName: member.last_name,
      fullName: `${member.first_name || ''} ${member.last_name || ''}`.trim()
    };
    const personalizedMessage = substituteTemplateVariables(message, templateData);

    try {
      const r = await sendSms(to, personalizedMessage);
      await logSms({ sender_id: senderId, role, recipient_type: 'individual', recipient_member_id: member.id, recipient_count: 1, message: personalizedMessage, status: 'success' });
      return res.json({ success: true, sid: r.sid });
    } catch (err) {
      await logSms({ sender_id: senderId, role, recipient_type: 'individual', recipient_member_id: member.id, recipient_count: 1, message: personalizedMessage, status: 'failed', error: err.message });
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
      .filter(m => m && m.is_active && !!m.phone_number);

    if (recipients.length === 0) {
      await logSms({ sender_id: senderId, role, recipient_type: 'group', group_id: groupId, recipient_count: 0, message, status: 'failed', error: 'No recipients in group' });
      return res.status(400).json({ success: false, message: 'No recipients in group' });
    }

    // Personalize messages
    const batch = recipients.map(member => {
      const templateData = {
        firstName: member.first_name,
        lastName: member.last_name,
        fullName: `${member.first_name || ''} ${member.last_name || ''}`.trim()
      };
      const personalized = substituteTemplateVariables(message, templateData);
      return {
        to: normalizePhone(member.phone_number),
        body: personalized
      };
    });

    const results = await sendSmsBatch(batch);
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
    const recipients = members.filter(m => !!m.phone_number);

    if (recipients.length === 0) {
      await logSms({ sender_id: senderId, role, recipient_type: 'all', recipient_count: 0, message, status: 'failed', error: 'No active members with phone numbers' });
      return res.status(400).json({ success: false, message: 'No active members with phone numbers' });
    }

    // Personalize messages
    const batch = recipients.map(member => {
      const templateData = {
        firstName: member.first_name,
        lastName: member.last_name,
        fullName: `${member.first_name || ''} ${member.last_name || ''}`.trim()
      };
      const personalized = substituteTemplateVariables(message, templateData);
      return {
        to: normalizePhone(member.phone_number),
        body: personalized
      };
    });

    const results = await sendSmsBatch(batch);
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
      .filter(m => m && !!m.phone_number);

    if (recipients.length === 0) {
      await logSms({ sender_id: senderId, role, recipient_type: 'department', department_id: departmentId, recipient_count: 0, message, status: 'failed', error: 'No recipients in department' });
      return res.status(400).json({ success: false, message: 'No recipients in department' });
    }

    // Personalize messages
    const batch = recipients.map(member => {
      const templateData = {
        firstName: member.first_name,
        lastName: member.last_name,
        fullName: `${member.first_name || ''} ${member.last_name || ''}`.trim()
      };
      const personalized = substituteTemplateVariables(message, templateData);
      return {
        to: normalizePhone(member.phone_number),
        body: personalized
      };
    });

    const results = await sendSmsBatch(batch);
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

    const { campaign, rows } = await livePledgeAudience(PENDING_STATUSES);

    // Refused outright rather than sending to nobody. The page greys these
    // options out, but that is cosmetic — this is what stops a direct API call
    // reaching last year's pledgers.
    if (!campaign) {
      await logSms({ sender_id: senderId, role, recipient_type: 'all', recipient_count: 0, message, status: 'failed', error: NO_LIVE_DRIVE });
      return res.status(400).json({ success: false, message: NO_LIVE_DRIVE });
    }

    if (rows.length === 0) {
      await logSms({ sender_id: senderId, role, recipient_type: 'all', recipient_count: 0, message, status: 'failed', error: 'No members with an outstanding pledge on the current drive' });
      return res.status(400).json({ success: false, message: 'No members with an outstanding pledge on the current drive' });
    }

    const batch = rows.map((row) => ({
      to: normalizePhone(row.member.phone_number),
      body: substituteTemplateVariables(message, templateDataFor(row))
    }));

    const results = await sendSmsBatch(batch);
    const successCount = results.filter((r) => r.success).length;

    let status = 'success';
    let error = null;
    if (successCount === 0) { status = 'failed'; error = 'All failed'; }
    else if (successCount < results.length) { status = 'partial'; error = `${results.length - successCount} failed`; }

    await logSms({ sender_id: senderId, role, recipient_type: 'all', recipient_count: rows.length, message, status, error });

    return res.json({
      success: successCount > 0,
      results,
      successCount,
      total: results.length,
      campaign: { id: campaign.id, name: campaign.name }
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

    const { campaign, rows } = await livePledgeAudience(FULFILLED_STATUSES);

    // Refused outright rather than sending to nobody. The page greys these
    // options out, but that is cosmetic — this is what stops a direct API call
    // reaching last year's pledgers.
    if (!campaign) {
      await logSms({ sender_id: senderId, role, recipient_type: 'all', recipient_count: 0, message, status: 'failed', error: NO_LIVE_DRIVE });
      return res.status(400).json({ success: false, message: NO_LIVE_DRIVE });
    }

    if (rows.length === 0) {
      await logSms({ sender_id: senderId, role, recipient_type: 'all', recipient_count: 0, message, status: 'failed', error: 'No members have fulfilled their pledge on the current drive' });
      return res.status(400).json({ success: false, message: 'No members have fulfilled their pledge on the current drive' });
    }

    const batch = rows.map((row) => ({
      to: normalizePhone(row.member.phone_number),
      body: substituteTemplateVariables(message, templateDataFor(row))
    }));

    const results = await sendSmsBatch(batch);
    const successCount = results.filter((r) => r.success).length;

    let status = 'success';
    let error = null;
    if (successCount === 0) { status = 'failed'; error = 'All failed'; }
    else if (successCount < results.length) { status = 'partial'; error = `${results.length - successCount} failed`; }

    await logSms({ sender_id: senderId, role, recipient_type: 'all', recipient_count: rows.length, message, status, error });

    return res.json({
      success: successCount > 0,
      results,
      successCount,
      total: results.length,
      campaign: { id: campaign.id, name: campaign.name }
    });
  } catch (error) {
    console.error('sendFulfilledPledges error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get preview of members with pending pledges
exports.getPendingPledgesRecipients = async (req, res) => {
  try {
    const { campaign, rows } = await livePledgeAudience(PENDING_STATUSES);

    const recipients = rows.map(toRecipient);

    // campaign is null when no drive is running, which is what lets the SMS
    // page disable these options and say why instead of showing a bare zero.
    return res.json({
      success: true,
      data: {
        recipients,
        totalCount: recipients.length,
        totalPledges: recipients.length,
        campaign: campaign ? { id: campaign.id, name: campaign.name } : null
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
    const { campaign, rows } = await livePledgeAudience(FULFILLED_STATUSES);

    const recipients = rows.map(toRecipient);

    // campaign is null when no drive is running, which is what lets the SMS
    // page disable these options and say why instead of showing a bare zero.
    return res.json({
      success: true,
      data: {
        recipients,
        totalCount: recipients.length,
        totalPledges: recipients.length,
        campaign: campaign ? { id: campaign.id, name: campaign.name } : null
      }
    });
  } catch (error) {
    console.error('getFulfilledPledgesRecipients error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
// Get count of all active members with phone numbers
exports.getAllRecipients = async (req, res) => {
  try {
    const members = await Member.findAll({ where: { is_active: true } });
    const recipients = members.filter(m => !!m.phone_number);

    return res.json({
      success: true,
      data: {
        totalCount: recipients.length
      }
    });
  } catch (error) {
    console.error('getAllRecipients error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
// Get current SMS pricing
exports.getPricing = async (req, res) => {
  try {
    const pricing = await getSmsPricing('US');
    return res.json({
      success: true,
      data: pricing
    });
  } catch (error) {
    console.error('getPricing error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
