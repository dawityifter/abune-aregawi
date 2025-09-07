const { Outreach, Member } = require('../models');
const { validationResult } = require('express-validator');

// Create an outreach note for a member
const createOutreach = async (req, res) => {
  try {
    // Validation is already handled by middleware, but double-check
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const memberId = parseInt(req.params.id, 10);
    const { note } = req.body || {};

    // Ensure member exists
    const member = await Member.findByPk(memberId);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    // Derive welcomed_by from authenticated user if available
    let welcomedBy = 'unknown';
    try {
      if (req.user?.id) welcomedBy = String(req.user.id);
      else if (req.user?.email) welcomedBy = req.user.email;
      else if (req.firebaseUid) welcomedBy = req.firebaseUid;
    } catch (_) {}

    const outreach = await Outreach.create({
      member_id: memberId,
      welcomed_by: welcomedBy,
      welcomed_date: new Date(),
      note: (note || '').trim()
    });

    return res.status(201).json({
      success: true,
      data: {
        id: outreach.id,
        member_id: outreach.member_id,
        welcomed_by: outreach.welcomed_by,
        welcomed_date: outreach.welcomed_date,
        note: outreach.note
      }
    });
  } catch (err) {
    console.error('createOutreach error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create outreach note' });
  }
};

// Optional: list outreach notes for a member
const listOutreach = async (req, res) => {
  try {
    const memberId = parseInt(req.params.id, 10);
    const member = await Member.findByPk(memberId);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const notes = await Outreach.findAll({
      where: { member_id: memberId },
      order: [['welcomed_date', 'DESC'], ['created_at', 'DESC']]
    });

    return res.status(200).json({ success: true, data: notes });
  } catch (err) {
    console.error('listOutreach error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load outreach notes' });
  }
};

module.exports = { createOutreach, listOutreach };
