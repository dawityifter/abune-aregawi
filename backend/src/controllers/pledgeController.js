const { Pledge, Member, Donation } = require('../models');
const { validationResult } = require('express-validator');

// Create a new pledge
const createPledge = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      amount,
      currency = 'usd',
      pledge_type = 'general',
      event_name,
      due_date,
      first_name,
      last_name,
      email,
      phone,
      address,
      zip_code,
      notes,
      metadata = {}
    } = req.body;

    // Validate amount
    if (!amount || amount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be at least $1.00'
      });
    }

    // Try to find existing member by email or phone
    let linkedMember = null;
    try {
      if (email) {
        linkedMember = await Member.findOne({ where: { email: email } });
      }
      if (!linkedMember && phone) {
        // Ensure phone starts with + for E.164
        const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;
        linkedMember = await Member.findOne({ where: { phone_number: normalizedPhone } });
      }
    } catch (memberErr) {
      console.warn('⚠️ Member lookup failed while creating pledge:', memberErr.message);
    }

    // Create pledge record
    const pledge = await Pledge.create({
      member_id: linkedMember ? linkedMember.id : null,
      amount,
      currency,
      pledge_type,
      event_name,
      status: 'pending',
      due_date: due_date ? new Date(due_date) : null,
      first_name,
      last_name,
      email,
      phone,
      address,
      zip_code,
      notes,
      metadata: {
        ...metadata,
        // Link to member when possible
        linkedMemberId: linkedMember ? linkedMember.id : null,
        source: metadata.source || 'website'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Pledge created successfully',
      pledge: {
        id: pledge.id,
        amount: pledge.amount,
        pledge_type: pledge.pledge_type,
        status: pledge.status,
        pledge_date: pledge.pledge_date,
        first_name: pledge.first_name,
        last_name: pledge.last_name,
        email: pledge.email
      }
    });

  } catch (error) {
    console.error('Error creating pledge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create pledge',
      error: error.message
    });
  }
};

// Get all pledges (admin only)
const getAllPledges = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      pledge_type,
      event_name,
      member_id
    } = req.query;

    const offset = (page - 1) * limit;

    const whereClause = {};
    if (status) whereClause.status = status;
    if (pledge_type) whereClause.pledge_type = pledge_type;
    if (event_name) whereClause.event_name = event_name;
    if (member_id) whereClause.member_id = member_id;

    const { count, rows: pledges } = await Pledge.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Member,
          as: 'member',
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: Donation,
          as: 'donation',
          attributes: ['id', 'amount', 'status']
        }
      ]
    });

    res.status(200).json({
      success: true,
      pledges: pledges.map(pledge => ({
        id: pledge.id,
        member_id: pledge.member_id,
        amount: pledge.amount,
        pledge_type: pledge.pledge_type,
        event_name: pledge.event_name,
        status: pledge.status,
        pledge_date: pledge.pledge_date,
        due_date: pledge.due_date,
        fulfilled_date: pledge.fulfilled_date,
        first_name: pledge.first_name,
        last_name: pledge.last_name,
        email: pledge.email,
        phone: pledge.phone,
        notes: pledge.notes,
        donation_id: pledge.donation_id,
        member: pledge.member,
        donation: pledge.donation,
        created_at: pledge.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Error getting pledges:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pledges',
      error: error.message
    });
  }
};

// Get pledge by ID
const getPledge = async (req, res) => {
  try {
    const { id } = req.params;

    const pledge = await Pledge.findByPk(id, {
      include: [
        {
          model: Member,
          as: 'member',
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: Donation,
          as: 'donation',
          attributes: ['id', 'amount', 'status', 'donation_type']
        }
      ]
    });

    if (!pledge) {
      return res.status(404).json({
        success: false,
        message: 'Pledge not found'
      });
    }

    res.status(200).json({
      success: true,
      pledge: {
        id: pledge.id,
        member_id: pledge.member_id,
        amount: pledge.amount,
        pledge_type: pledge.pledge_type,
        event_name: pledge.event_name,
        status: pledge.status,
        pledge_date: pledge.pledge_date,
        due_date: pledge.due_date,
        fulfilled_date: pledge.fulfilled_date,
        first_name: pledge.first_name,
        last_name: pledge.last_name,
        email: pledge.email,
        phone: pledge.phone,
        address: pledge.address,
        zip_code: pledge.zip_code,
        notes: pledge.notes,
        donation_id: pledge.donation_id,
        metadata: pledge.metadata,
        member: pledge.member,
        donation: pledge.donation,
        created_at: pledge.created_at,
        updated_at: pledge.updated_at
      }
    });

  } catch (error) {
    console.error('Error getting pledge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pledge',
      error: error.message
    });
  }
};

// Update pledge status
const updatePledge = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, donation_id, notes, fulfilled_date } = req.body;

    const pledge = await Pledge.findByPk(id);
    if (!pledge) {
      return res.status(404).json({
        success: false,
        message: 'Pledge not found'
      });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (donation_id) updateData.donation_id = donation_id;
    if (notes !== undefined) updateData.notes = notes;
    if (fulfilled_date && status === 'fulfilled') {
      updateData.fulfilled_date = new Date(fulfilled_date);
    } else if (status === 'fulfilled' && !pledge.fulfilled_date) {
      updateData.fulfilled_date = new Date();
    }

    await pledge.update(updateData);

    res.status(200).json({
      success: true,
      message: 'Pledge updated successfully',
      pledge: pledge
    });

  } catch (error) {
    console.error('Error updating pledge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update pledge',
      error: error.message
    });
  }
};

// Get pledge statistics
const getPledgeStats = async (req, res) => {
  try {
    const { event_name } = req.query;

    const whereClause = {};
    if (event_name) whereClause.event_name = event_name;

    // Get total pledged amount
    const totalPledged = await Pledge.sum('amount', {
      where: { ...whereClause, status: ['pending', 'fulfilled'] }
    }) || 0;

    // Get total fulfilled amount
    const totalFulfilled = await Pledge.sum('amount', {
      where: { ...whereClause, status: 'fulfilled' }
    }) || 0;

    // Get individual pledges by status with member info
    const pledgesByStatus = await Pledge.findAll({
      where: whereClause,
      include: [{
        model: Member,
        as: 'member',
        attributes: ['first_name', 'last_name', 'spouse_name']
      }],
      order: [['created_at', 'DESC']]
    });

    // Group pledges by status and include member/spouse info
    const statusBreakdownMap = {};
    pledgesByStatus.forEach(pledge => {
      const status = pledge.status;
      if (!statusBreakdownMap[status]) {
        statusBreakdownMap[status] = {
          status: status,
          count: 0,
          total_amount: 0,
          pledges: []
        };
      }

      statusBreakdownMap[status].count += 1;
      statusBreakdownMap[status].total_amount += parseFloat(pledge.amount);

      // Add pledge with member/spouse info
      const pledgeInfo = {
        id: pledge.id,
        amount: parseFloat(pledge.amount),
        name: `${pledge.first_name} ${pledge.last_name}`,
        spouse_name: pledge.member?.spouse_name || null,
        pledge_type: pledge.pledge_type,
        created_at: pledge.created_at
      };

      statusBreakdownMap[status].pledges.push(pledgeInfo);
    });

    // Convert to array format
    const statusBreakdown = Object.values(statusBreakdownMap);

    // Get recent pledges
    const recentPledges = await Pledge.findAll({
      where: whereClause,
      limit: 10,
      order: [['created_at', 'DESC']],
      attributes: ['id', 'first_name', 'last_name', 'amount', 'pledge_type', 'created_at'],
      include: [{
        model: Member,
        as: 'member',
        attributes: ['first_name', 'last_name']
      }]
    });

    res.status(200).json({
      success: true,
      stats: {
        total_pledged: parseFloat(totalPledged),
        total_fulfilled: parseFloat(totalFulfilled),
        total_remaining: parseFloat(totalPledged) - parseFloat(totalFulfilled),
        fulfillment_rate: totalPledged > 0 ? (totalFulfilled / totalPledged * 100).toFixed(1) : 0,
        status_breakdown: statusBreakdown.map(stat => ({
          status: stat.status,
          count: stat.count,
          total_amount: stat.total_amount,
          pledges: stat.pledges
        })),
        recent_pledges: recentPledges.map(pledge => ({
          id: pledge.id,
          name: `${pledge.first_name} ${pledge.last_name}`,
          amount: parseFloat(pledge.amount),
          pledge_type: pledge.pledge_type,
          created_at: pledge.created_at,
          member: pledge.member
        }))
      }
    });

  } catch (error) {
    console.error('Error getting pledge stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pledge statistics',
      error: error.message
    });
  }
};

module.exports = {
  createPledge,
  getAllPledges,
  getPledge,
  updatePledge,
  getPledgeStats
};
