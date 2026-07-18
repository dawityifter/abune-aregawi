const { Member, Dependent } = require('../models');

// Split a legacy members.spouse_name string into first/last parts.
// Returns null when the name is empty.
const splitSpouseName = (spouseName) => {
  const s = String(spouseName || '').trim();
  if (!s) return null;
  const i = s.indexOf(' ');
  return {
    firstName: i < 0 ? s : s.slice(0, i),
    lastName: i < 0 ? '' : s.slice(i + 1)
  };
};

// Member Information report: active member directory with spouse contact
// details. Spouse first/last/phone come from the dependents table
// (relationship = 'Spouse'); members.spouse_name is only a display fallback
// for members registered before spouse dependents existed.
const getMemberInformationReport = async (req, res) => {
  try {
    const members = await Member.findAll({
      where: { is_active: true },
      attributes: ['id', 'first_name', 'last_name', 'phone_number', 'spouse_name'],
      order: [['id', 'ASC']],
      raw: true
    });

    const spouseRows = members.length > 0 ? await Dependent.findAll({
      where: { relationship: 'Spouse', memberId: members.map((m) => m.id) },
      attributes: ['memberId', 'firstName', 'lastName', 'phone'],
      raw: true
    }) : [];
    const spouseByMember = new Map(spouseRows.map((s) => [String(s.memberId), s]));

    const rows = members.map((m) => {
      const spouse = spouseByMember.get(String(m.id));
      const fallback = spouse ? null : splitSpouseName(m.spouse_name);
      return {
        id: m.id,
        first_name: m.first_name,
        last_name: m.last_name,
        phone_number: m.phone_number,
        spouse_first_name: spouse?.firstName || fallback?.firstName || null,
        spouse_last_name: spouse?.lastName || fallback?.lastName || null,
        spouse_phone: spouse?.phone || null
      };
    });

    res.json({
      success: true,
      data: {
        reportType: 'member_information',
        generatedAt: new Date().toISOString(),
        totalActiveMembers: rows.length,
        members: rows
      }
    });
  } catch (error) {
    console.error('Error generating member information report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate member information report' });
  }
};

module.exports = {
  splitSpouseName,
  getMemberInformationReport
};
