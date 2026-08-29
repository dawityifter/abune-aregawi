const { Pledge, Member, Donation, PledgeBalance, ActivityLog } = require('../models');
const { validationResult } = require('express-validator');
const { findLiveCampaign } = require('../services/pledgeCampaignService');

// Same vocabulary as pledgeRoutes.js — do not invent role names.
const BALANCE_VIEW_ROLES = ['admin', 'treasurer', 'church_leadership', 'secretary',
  'bookkeeper', 'auditor', 'budget_committee', 'ar_team', 'ap_team'];

// Who may create a pledge on someone else's behalf (a treasurer taking a
// pledge card at an event, say).
const PLEDGE_ON_BEHALF_ROLES = ['admin', 'treasurer'];

// Anonymous to the parish, never anonymous to the treasurer. Deliberately
// narrower than BALANCE_VIEW_ROLES: a donor who asked for anonymity should not
// have their name visible to all nine view roles.
const ANONYMITY_PIERCING_ROLES = ['admin', 'treasurer'];

const canPierceAnonymity = (req) =>
  (req.user?.roles || []).some((r) => ANONYMITY_PIERCING_ROLES.includes(r));

/**
 * Strips an anonymous donor's identity out of a serialized pledge for the
 * seven view roles that are not admin or treasurer (A2).
 *
 * For an ONLINE anonymous gift `first_name`/`last_name` hold the giver's real
 * legal name — StripePayment sends the name on the card and createPaymentIntent
 * prefers it over the 'Anonymous'/'Giver' placeholders — so leaving those
 * fields alone would publish exactly what the donor asked to keep private.
 * `is_anonymous` is always returned so a client knows the payload is masked
 * rather than guessing from a name that reads as "Anonymous".
 */
const maskAnonymousPledge = (payload, canPierce) => {
  if (!payload.is_anonymous || canPierce) return payload;
  return {
    ...payload,
    first_name: 'Anonymous',
    last_name: '',
    email: null,
    phone: null,
    ...('address' in payload ? { address: null } : {}),
    ...('zip_code' in payload ? { zip_code: null } : {}),
    ...('metadata' in payload ? { metadata: null } : {}),
    member_id: null,
    member: null
  };
};

/**
 * The member's pledge in the live campaign, with balances from
 * pledge_balances. Serves two callers with one payload: a member reading their
 * own (no role needed — it is their own record), and staff reading someone
 * else's via ?member_id, which does require a view role.
 */
const getPledgeBalance = async (req, res) => {
  try {
    const requestedId = req.query.member_id;
    const callerId = req.user.member_id;

    const targetId = requestedId ? String(requestedId) : String(callerId);
    const isSelf = targetId === String(callerId);

    if (!isSelf) {
      const roles = req.user.roles || [];
      if (!roles.some((r) => BALANCE_VIEW_ROLES.includes(r))) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view another member\'s pledge'
        });
      }
    }

    const campaign = await findLiveCampaign();
    if (!campaign) return res.status(200).json({ success: true, pledge: null });

    const pledge = await Pledge.findOne({
      where: {
        campaign_id: campaign.id,
        member_id: targetId,
        lifecycle: 'active',
        is_historical: false,
        // Only 'later' pledges are outstanding; 'immediate' pledges are already paid.
        fulfillment_intent: 'later'
      }
    });
    if (!pledge) return res.status(200).json({ success: true, pledge: null });

    // Balances come from the view (real payments), never from legacy_status.
    const balance = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });

    const pledged = parseFloat(balance?.pledged_amount ?? pledge.amount) || 0;
    const paid = parseFloat(balance?.paid_amount ?? 0) || 0;

    return res.status(200).json({
      success: true,
      pledge: {
        id: pledge.id,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        pledged_amount: pledged,
        paid_amount: paid,
        remaining_amount: pledged - paid
      }
    });
  } catch (error) {
    console.error('Error loading pledge balance:', error);
    return res.status(500).json({ success: false, message: 'Failed to load pledge balance' });
  }
};

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

    // A pledge for future fulfillment can never be anonymous — the church would
    // have no way to collect on it. Anonymity requires paying at the same time.
    if (req.body.is_anonymous) {
      return res.status(400).json({
        success: false,
        message: 'An anonymous contribution must be pledged and paid at the same time.'
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

    // The caller IS the pledger, unless a privileged caller names someone else.
    // Note that PledgeForm has always sent member_id and createPledge has always
    // ignored it, silently overriding an admin's explicit choice with a guess.
    // This is the first time that parameter means anything.
    const callerRoles = req.user.roles || [];
    const canPledgeOnBehalf = callerRoles.some((r) => PLEDGE_ON_BEHALF_ROLES.includes(r));
    const linkedMemberId = (canPledgeOnBehalf && req.body.member_id)
      ? req.body.member_id
      : req.user.member_id;

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
      member_id: linkedMemberId,
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
      fulfillment_intent: 'later',
      metadata: {
        ...metadata,
        linkedMemberId,
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
    // pledges_one_active_per_member_per_campaign. Per A1 a PAID 'later' pledge
    // still counts, so a member who settled theirs in full and came back is the
    // ordinary way to land here — that is a 409 with an explanation, not a 500
    // leaking a raw Sequelize message about a partial unique index.
    if (error && error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        message: 'You already have a pledge in this drive'
      });
    }
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

    const canPierce = canPierceAnonymity(req);

    res.status(200).json({
      success: true,
      pledges: pledges.map(pledge => maskAnonymousPledge({
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
        is_anonymous: pledge.is_anonymous,
        notes: pledge.notes,
        donation_id: pledge.donation_id,
        member: pledge.member,
        donation: pledge.donation,
        created_at: pledge.created_at
      }, canPierce)),
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
      pledge: maskAnonymousPledge({
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
        is_anonymous: pledge.is_anonymous,
        notes: pledge.notes,
        donation_id: pledge.donation_id,
        metadata: pledge.metadata,
        member: pledge.member,
        donation: pledge.donation,
        created_at: pledge.created_at,
        updated_at: pledge.updated_at
      }, canPierceAnonymity(req))
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
          attributes: ['first_name', 'last_name', 'pledge_type', 'event_name',
                       'created_at', 'is_anonymous'],
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

    const canSeeAnonymousNames = canPierceAnonymity(req);
    const displayName = (pledge) =>
      (pledge.is_anonymous && !canSeeAnonymousNames)
        ? 'Anonymous'
        : `${pledge.first_name} ${pledge.last_name}`;

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
        is_anonymous: Boolean(balance.pledge.is_anonymous),
        name: displayName(balance.pledge),
        spouse_name: (balance.pledge.is_anonymous && !canSeeAnonymousNames)
          ? null
          : (balance.member?.spouse_name || null),
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
            name: displayName(balance.pledge),
            is_anonymous: Boolean(balance.pledge.is_anonymous),
            amount: parseFloat(balance.pledged_amount) || 0,
            pledge_type: balance.pledge.pledge_type,
            created_at: balance.pledge.created_at,
            member: (balance.member && !(balance.pledge.is_anonymous && !canSeeAnonymousNames))
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
  getPledgeStats,
  getPledgeBalance
};
