'use strict';

const { sequelize, Group, MemberGroup } = require('../models');

exports.listActive = async (req, res) => {
  try {
    const includeCounts = String(req.query.includeCounts || 'false').toLowerCase() === 'true';

    // Base: active groups
    const groups = await Group.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']],
      attributes: ['id', 'name', 'description', 'created_at', 'updated_at']
    });

    let countsByGroupId = {};
    if (includeCounts) {
      // Get member counts per group
      const rows = await MemberGroup.findAll({
        attributes: [
          'group_id',
          [sequelize.fn('COUNT', sequelize.col('member_id')), 'member_count']
        ],
        group: ['group_id']
      });
      countsByGroupId = rows.reduce((acc, r) => {
        const gId = r.get('group_id');
        const cnt = Number(r.get('member_count')) || 0;
        acc[String(gId)] = cnt;
        return acc;
      }, {});
    }

    const data = groups.map(g => {
      const id = g.id;
      const name = g.name || '';
      const description = g.description || '';
      const member_count = includeCounts ? (countsByGroupId[String(id)] || 0) : undefined;
      const parts = [name];
      if (includeCounts) parts.push(`(${member_count} member${member_count === 1 ? '' : 's'})`);
      if (description) parts.push(`— ${description}`);
      const label = parts.filter(Boolean).join(' ');
      return {
        id,
        name,
        description,
        member_count,
        label,
        created_at: g.created_at,
        updated_at: g.updated_at
      };
    });

    return res.json({ success: true, data });
  } catch (error) {
    console.error('listActive groups error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load groups' });
  }
};
