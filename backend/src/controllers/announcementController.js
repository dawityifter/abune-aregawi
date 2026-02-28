'use strict';
const { Announcement } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

// GET /api/announcements?status=active|cancelled|expired|all
const listAnnouncements = async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    const today = new Date().toISOString().split('T')[0];
    let where = {};

    if (status === 'active') {
      where = { status: 'active', start_date: { [Op.lte]: today }, end_date: { [Op.gte]: today } };
    } else if (status === 'cancelled') {
      where = { status: 'cancelled' };
    } else if (status === 'expired') {
      where = { status: 'active', end_date: { [Op.lt]: today } };
    }

    const announcements = await Announcement.findAll({ where, order: [['start_date', 'DESC']] });
    return res.json({ success: true, data: announcements });
  } catch (err) {
    console.error('listAnnouncements error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list announcements' });
  }
};

// GET /api/announcements/active — TV feed
const getActiveAnnouncements = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const announcements = await Announcement.findAll({
      where: { status: 'active', start_date: { [Op.lte]: today }, end_date: { [Op.gte]: today } },
      order: [['start_date', 'DESC']]
    });
    return res.json({ success: true, data: announcements });
  } catch (err) {
    console.error('getActiveAnnouncements error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch active announcements' });
  }
};

// POST /api/announcements
const createAnnouncement = async (req, res) => {
  try {
    const { title, description, start_date, end_date } = req.body;
    if (!title || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'title, start_date, and end_date are required' });
    }
    const createdByMemberId = req.user?.id || null;
    const announcement = await Announcement.create({
      id: uuidv4(), title, description, start_date, end_date,
      status: 'active', created_by_member_id: createdByMemberId
    });
    return res.status(201).json({ success: true, data: announcement });
  } catch (err) {
    console.error('createAnnouncement error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create announcement' });
  }
};

// PUT /api/announcements/:id
const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findByPk(id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });

    const { title, description, start_date, end_date } = req.body;
    await announcement.update({ title, description, start_date, end_date });
    return res.json({ success: true, data: announcement });
  } catch (err) {
    console.error('updateAnnouncement error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update announcement' });
  }
};

// PATCH /api/announcements/:id/cancel
const cancelAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findByPk(id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });
    await announcement.update({ status: 'cancelled' });
    return res.json({ success: true, data: announcement });
  } catch (err) {
    console.error('cancelAnnouncement error:', err);
    return res.status(500).json({ success: false, message: 'Failed to cancel announcement' });
  }
};

module.exports = { listAnnouncements, getActiveAnnouncements, createAnnouncement, updateAnnouncement, cancelAnnouncement };
