const { MemberPayment, Member } = require('../models');
const { Op, literal } = require('sequelize');

// Get all member payments with pagination and filtering
const getAllMemberPayments = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};

    // Search functionality (now uses memberName and memberId)
    if (search) {
      whereClause = {
        ...whereClause,
        [Op.or]: [
          { memberName: { [Op.iLike]: `%${search}%` } },
          literal(`CAST("member_id" AS TEXT) ILIKE '%${search}%'`)
        ]
      };
    }

    // Status filtering (now uses balanceDue)
    if (status) {
      switch (status) {
        case 'up_to_date':
          whereClause.balanceDue = { [Op.lte]: 0 };
          break;
        case 'behind':
          whereClause.balanceDue = { [Op.gt]: 0 };
          break;
        case 'partial':
          whereClause.balanceDue = { [Op.gt]: 0 };
          whereClause.totalCollected = { [Op.gt]: 0 };
          break;
      }
    }

    const payments = await MemberPayment.findAndCountAll({
      where: whereClause,
      // include: [
      //   {
      //     model: Member,
      //     as: 'member',
      //     where: memberWhereClause,
      //     attributes: ['id', 'first_name', 'last_name', 'member_id', 'phone_number', 'email']
      //   }
      // ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['memberName', 'ASC']]
    });

    res.json({
      success: true,
      data: payments.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(payments.count / limit),
        totalItems: payments.count,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching member payments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch member payments' });
  }
};

// Get payment details for a specific member
const getMemberPaymentDetails = async (req, res) => {
  try {
    const { memberId } = req.params;

    const payment = await MemberPayment.findOne({
      where: { memberId },
      include: [
        {
          model: Member,
          as: 'member',
          attributes: ['id', 'first_name', 'last_name', 'member_id', 'phone_number', 'email', 'spouse_name']
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    console.error('Error fetching member payment details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payment details' });
  }
};

// Add or update payment for a member
const addMemberPayment = async (req, res) => {
  try {
    const { memberId, month, amount, paymentMethod, notes } = req.body;

    // Validate required fields
    if (!memberId || !month || !amount || !paymentMethod) {
      return res.status(400).json({ 
        success: false, 
        message: 'Member ID, month, amount, and payment method are required' 
      });
    }

    // Find existing payment record
    let payment = await MemberPayment.findOne({ where: { memberId } });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Member payment record not found' });
    }

    // Update the specific month's payment
    const monthField = month.toLowerCase();
    if (!payment[monthField] && payment[monthField] !== 0) {
      return res.status(400).json({ success: false, message: `Invalid month: ${month}` });
    }

    // Update payment
    payment[monthField] = parseFloat(amount);
    payment.paymentMethod = paymentMethod;
    payment.notes = notes || payment.notes;
    
    // Recalculate totals
    const monthlyPayments = [
      payment.january, payment.february, payment.march, payment.april,
      payment.may, payment.june, payment.july, payment.august,
      payment.september, payment.october, payment.november, payment.december
    ].filter(p => p && p > 0);

    payment.totalCollected = monthlyPayments.reduce((sum, p) => sum + p, 0);
    payment.balanceDue = payment.totalAmountDue - payment.totalCollected;

    await payment.save();

    res.json({ 
      success: true, 
      message: 'Payment updated successfully',
      data: payment 
    });
  } catch (error) {
    console.error('Error adding member payment:', error);
    res.status(500).json({ success: false, message: 'Failed to add payment' });
  }
};

// Generate payment reports
const generatePaymentReport = async (req, res) => {
  try {
    const { reportType = 'summary' } = req.query;

    let reportData = {};

    switch (reportType) {
      case 'summary':
        // Summary statistics
        const totalMembers = await MemberPayment.count();
        const upToDateMembers = await MemberPayment.count({
          where: { totalAmountDue: { [Op.lte]: 0 } }
        });
        const behindMembers = await MemberPayment.count({
          where: { totalAmountDue: { [Op.gt]: 0 } }
        });
        const totalAmountDue = await MemberPayment.sum('totalAmountDue');
        const totalCollected = await MemberPayment.sum('totalCollected');

        reportData = {
          totalMembers,
          upToDateMembers,
          behindMembers,
          totalAmountDue: totalAmountDue || 0,
          totalCollected: totalCollected || 0,
          collectionRate: totalMembers > 0 ? ((upToDateMembers / totalMembers) * 100).toFixed(2) : 0
        };
        break;

      case 'behind_payments':
        // Members behind on payments
        const behindPayments = await MemberPayment.findAll({
          where: { totalAmountDue: { [Op.gt]: 0 } },
          include: [
            {
              model: Member,
              as: 'member',
              attributes: ['firstName', 'lastName', 'memberId', 'phoneNumber', 'email']
            }
          ],
          order: [['totalAmountDue', 'DESC']]
        });
        reportData = { behindPayments };
        break;

      case 'monthly_breakdown':
        // Monthly payment breakdown
        const monthlyStats = await MemberPayment.findAll({
          attributes: [
            'january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'
          ]
        });

        const monthlyTotals = {
          january: 0, february: 0, march: 0, april: 0, may: 0, june: 0,
          july: 0, august: 0, september: 0, october: 0, november: 0, december: 0
        };

        monthlyStats.forEach(record => {
          Object.keys(monthlyTotals).forEach(month => {
            if (record[month] && record[month] > 0) {
              monthlyTotals[month] += record[month];
            }
          });
        });

        reportData = { monthlyTotals };
        break;

      default:
        return res.status(400).json({ success: false, message: 'Invalid report type' });
    }

    res.json({ success: true, data: reportData });
  } catch (error) {
    console.error('Error generating payment report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
};

// Get payment statistics for dashboard
const getPaymentStats = async (req, res) => {
  try {
    const [
      totalMembers,
      upToDateMembers,
      behindMembers,
      totalAmountDue,
      totalCollected
    ] = await Promise.all([
      MemberPayment.count(),
      MemberPayment.count({ where: { totalAmountDue: { [Op.lte]: 0 } } }),
      MemberPayment.count({ where: { totalAmountDue: { [Op.gt]: 0 } } }),
      MemberPayment.sum('totalAmountDue'),
      MemberPayment.sum('totalCollected')
    ]);

    const stats = {
      totalMembers,
      upToDateMembers,
      behindMembers,
      totalAmountDue: totalAmountDue || 0,
      totalCollected: totalCollected || 0,
      collectionRate: totalMembers > 0 ? ((upToDateMembers / totalMembers) * 100).toFixed(2) : 0,
      outstandingAmount: (totalAmountDue || 0) - (totalCollected || 0)
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payment statistics' });
  }
};

module.exports = {
  getAllMemberPayments,
  getMemberPaymentDetails,
  addMemberPayment,
  generatePaymentReport,
  getPaymentStats,
  getMyDues
};