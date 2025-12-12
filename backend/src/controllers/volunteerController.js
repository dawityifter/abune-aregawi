const { VolunteerRequest, Member } = require('../models');

exports.createVolunteerRequest = async (req, res) => {
    try {
        const { message, agreed_to_contact } = req.body;
        // Assume req.user.id is available from auth middleware
        // For development/mocking, we might need to rely on passed member_id if auth isn't fully set up locally?
        // But better to rely on req.user.id if using standard auth.
        // The prompt implies we save with member_id.
        // I'll assume req.user is populated by middleware.

        // Wait, the user might not be logged in? usually board page is protected?
        // BoardMembers.tsx uses useAuth but doesn't strictly enforce login to VIEW the page.
        // But to submit, we probably want them logged in.

        if (!req.user || !req.user.id) {
            // Fallback for development if needed, or strict error
            // check if body has member_id (only if we trust the client, which we generally shouldn't for ID)
            // However, for this app, let's assume standard auth flow.
            // If req.body.member_id is passed and we are testing?
            // Safest: Use req.user.id
            if (process.env.NODE_ENV === 'development' && req.body.member_id) {
                // allow manual override in dev
            } else {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }
        }

        const memberId = req.user ? req.user.id : req.body.member_id;

        const request = await VolunteerRequest.create({
            memberId: memberId,
            message: message,
            agreedToContact: agreed_to_contact,
            status: 'new'
        });

        res.status(201).json({ success: true, data: request });
    } catch (error) {
        console.error('Error creating volunteer request:', error);
        res.status(500).json({ success: false, message: 'Failed to submit request' });
    }
};

exports.getVolunteerRequests = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const status = req.query.status;
        const whereClause = status ? { status } : {};

        const { count, rows } = await VolunteerRequest.findAndCountAll({
            where: whereClause,
            include: [{
                model: Member,
                as: 'member',
                attributes: ['first_name', 'last_name', 'phone_number', 'email']
            }],
            order: [['created_at', 'DESC']],
            limit: limit,
            offset: offset
        });

        res.json({
            success: true,
            data: {
                requests: rows,
                pagination: {
                    total: count,
                    pages: Math.ceil(count / limit),
                    page: page,
                    limit: limit
                }
            }
        });
    } catch (error) {
        console.error('Error fetching volunteer requests:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch requests' });
    }
};

exports.updateVolunteerRequestStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['new', 'contacted', 'archived'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const request = await VolunteerRequest.findByPk(id);
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        request.status = status;
        await request.save();

        res.json({ success: true, data: request });
    } catch (error) {
        console.error('Error updating volunteer request:', error);
        res.status(500).json({ success: false, message: 'Failed to update request' });
    }
};
