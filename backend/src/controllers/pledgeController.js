const { Pledge, Member, Donation, PledgeBalance, ActivityLog } = require('../models');
const { validationResult } = require('express-validator');
const { findLiveCampaign } = require('../services/pledgeCampaignService');

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

    // Pledges bind to the campaign that is live right now — active AND inside
    // its date window. Resolved server-side and any client-supplied
    // campaign_id is ignored on purpose: a crafted request must not be able to
    // attach a pledge to a different drive, including a draft one that the
    // previous non-closed check would have accepted.
    const liveCampaign = await findLiveCampaign();
    if (!liveCampaign) {
      return res.status(503).json({
        success: false,
        message: 'Pledges are not currently being accepted'
      });
    }

    // Create pledge record
    const pledge = await Pledge.create({
      member_id: linkedMember ? linkedMember.id : null,
      campaign_id: liveCampaign.id,
      amount,
      currency,
      pledge_type,
      event_name,
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
        status: pledge.legacy_status,
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
    if (status) whereClause.legacy_status = status;
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
        status: pledge.legacy_status,
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
        status: pledge.legacy_status,
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

// Update pledge — lifecycle (active/cancelled) and notes only. Fulfillment is
// never stored here; it is always derived from real payments (pledge_balances).
const updatePledge = async (req, res) => {
  try {
    const { id } = req.params;
    const { lifecycle, notes } = req.body;

    if (lifecycle !== undefined && !['active', 'cancelled'].includes(lifecycle)) {
      return res.status(400).json({
        success: false,
        message: "lifecycle must be 'active' or 'cancelled'"
      });
    }

    const pledge = await Pledge.findByPk(id);
    if (!pledge) {
      return res.status(404).json({
        success: false,
        message: 'Pledge not found'
      });
    }

    const previousLifecycle = pledge.lifecycle;

    const updateData = {};
    if (notes !== undefined) updateData.notes = notes;
    if (lifecycle !== undefined) updateData.lifecycle = lifecycle;

    await pledge.update(updateData);

    if (lifecycle !== undefined && lifecycle !== previousLifecycle) {
      await ActivityLog.create({
        user_id: req.user.id,
        action: 'UPDATE',
        entity_type: 'Pledge',
        entity_id: String(pledge.id),
        details: { from: previousLifecycle, to: lifecycle },
        ip_address: req.ip
      });
    }

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

// Get pledge statistics — derived from pledge_balances (real payments), not
// the frozen legacy_status column. See docs/superpowers/specs/
// 2026-08-20-pledge-modernization-design.md section 8.4.
const getPledgeStats = async (req, res) => {
  try {
    const { event_name, campaign_id } = req.query;

    // Detail (per-pledge rows incl. donor names) is privileged. The route layer
    // authenticates; this flag decides what gets serialized.
    const wantDetail = req.query.detail === 'true';

    // event_name only exists on the pledges table, so filtering by it means
    // filtering the balances whose underlying pledge matches.
    const balances = await PledgeBalance.findAll({
      include: [
        {
          model: Pledge,
          as: 'pledge',
          attributes: ['first_name', 'last_name', 'pledge_type', 'event_name', 'created_at'],
          required: true,
          // campaign_id scopes the public tracker to the current drive. Both
          // filters are optional; omitting them keeps the all-campaign total
          // that staff callers already rely on.
          where: {
            ...(event_name ? { event_name } : {}),
            ...(campaign_id ? { campaign_id } : {})
          }
        },
        {
          model: Member,
          as: 'member',
          attributes: ['first_name', 'last_name', 'spouse_name']
        }
      ],
      order: [[{ model: Pledge, as: 'pledge' }, 'created_at', 'DESC']]
    });

    let totalPledged = 0;
    let totalFulfilled = 0;
    const statusBreakdownMap = {};

    balances.forEach(balance => {
      const pledgedAmount = parseFloat(balance.pledged_amount) || 0;
      const paidAmount = parseFloat(balance.paid_amount) || 0;
      const status = balance.derived_status;

      // Cancelled pledges are excluded from the headline totals, but still
      // show up in the status breakdown so admins can see them.
      if (status !== 'cancelled') {
        totalPledged += pledgedAmount;
        totalFulfilled += paidAmount;
      }

      if (!statusBreakdownMap[status]) {
        statusBreakdownMap[status] = {
          status,
          count: 0,
          total_amount: 0,
          pledges: []
        };
      }

      statusBreakdownMap[status].count += 1;
      statusBreakdownMap[status].total_amount += pledgedAmount;

      statusBreakdownMap[status].pledges.push({
        id: balance.pledge_id,
        amount: pledgedAmount,
        // Per-donor payment progress, so a caller can tell who actually paid
        // rather than only who promised. Derived from pledge_balances, never
        // from the frozen legacy_status column.
        paid_amount: paidAmount,
        remaining_amount: parseFloat(balance.remaining_amount) || 0,
        // True when the figures come from the pre-allocation legacy_status
        // record rather than from real payments, so the UI can say so.
        is_historical: Boolean(balance.is_historical),
        name: `${balance.pledge.first_name} ${balance.pledge.last_name}`,
        spouse_name: balance.member?.spouse_name || null,
        pledge_type: balance.pledge.pledge_type,
        created_at: balance.pledge.created_at
      });
    });

    const statusBreakdown = Object.values(statusBreakdownMap);

    // Already ordered by pledge.created_at DESC above.
    const recentPledges = balances.slice(0, 10);

    res.status(200).json({
      success: true,
      stats: {
        total_pledged: totalPledged,
        total_fulfilled: totalFulfilled,
        total_remaining: totalPledged - totalFulfilled,
        fulfillment_rate: totalPledged > 0 ? (totalFulfilled / totalPledged * 100).toFixed(1) : 0,
        status_breakdown: statusBreakdown.map(stat => ({
          status: stat.status,
          count: stat.count,
          total_amount: stat.total_amount,
          ...(wantDetail ? { pledges: stat.pledges } : {})
        })),
        ...(wantDetail ? {
          recent_pledges: recentPledges.map(balance => ({
            id: balance.pledge_id,
            name: `${balance.pledge.first_name} ${balance.pledge.last_name}`,
            amount: parseFloat(balance.pledged_amount) || 0,
            pledge_type: balance.pledge.pledge_type,
            created_at: balance.pledge.created_at,
            member: balance.member
              ? { first_name: balance.member.first_name, last_name: balance.member.last_name }
              : null
          }))
        } : {})
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
