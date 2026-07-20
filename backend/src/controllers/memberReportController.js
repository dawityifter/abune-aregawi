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

const fullName = (first, last) => [first, last].filter(Boolean).join(' ');

const compareNames = (a, b) =>
  String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' });

const sameName = (a, b) => compareNames(a, b) === 0;

// Age as of today, decremented if this year's birthday hasn't happened yet.
// Parses the YYYY-MM-DD components directly rather than `new Date(dob)` +
// local getters — that combination reads midnight UTC back in local time,
// which shifts the DOB a day earlier in any negative-UTC-offset timezone
// (e.g. America/Chicago) and reports the age one year too high on the day
// before the birthday. Returns null for missing/malformed dates — never
// leaks the raw DOB.
const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const [year, month, day] = String(dateOfBirth).slice(0, 10).split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const today = new Date();
  let age = today.getFullYear() - year;
  const monthDiff = (today.getMonth() + 1) - month;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
    age--;
  }
  return age;
};

// Household Membership Directory: households grouped under each head of
// household (family_id null or = own id), with spouse from the dependents
// table (spouse_name as legacy fallback), dependents oldest-first, and any
// other registered members linked via family_id. No DOBs, emails, or
// financial data in the payload — this prints as a public-facing directory.
const VALID_SORT_BY = ['last_name', 'first_name'];

const getHouseholdDirectoryReport = async (req, res) => {
  try {
    const sortBy = String(req.query.sort_by || '').trim() || 'last_name';

    if (!VALID_SORT_BY.includes(sortBy)) {
      return res.status(400).json({ success: false, message: 'Invalid sort_by' });
    }

    const members = await Member.findAll({
      where: { is_active: true },
      attributes: ['id', 'first_name', 'last_name', 'phone_number', 'spouse_name', 'family_id', 'date_of_birth'],
      raw: true
    });

    const isHead = (m) => !m.family_id || String(m.family_id) === String(m.id);

    const heads = members.filter(isHead);

    const linkedByHead = new Map();
    for (const m of members) {
      if (isHead(m)) continue;
      const key = String(m.family_id);
      if (!linkedByHead.has(key)) linkedByHead.set(key, []);
      linkedByHead.get(key).push(m);
    }

    const dependentRows = heads.length > 0 ? await Dependent.findAll({
      where: { memberId: heads.map((m) => m.id) },
      attributes: ['memberId', 'firstName', 'lastName', 'relationship', 'phone', 'dateOfBirth'],
      raw: true
    }) : [];
    const dependentsByHead = new Map();
    for (const d of dependentRows) {
      const key = String(d.memberId);
      if (!dependentsByHead.has(key)) dependentsByHead.set(key, []);
      dependentsByHead.get(key).push(d);
    }

    let totalSpouses = 0;
    let totalDependents = 0;
    let totalOtherMembers = 0;

    const households = heads
      .slice()
      .sort((a, b) => sortBy === 'first_name'
        ? compareNames(a.first_name, b.first_name) || compareNames(a.last_name, b.last_name)
        : compareNames(a.last_name, b.last_name) || compareNames(a.first_name, b.first_name))
      .map((head) => {
        const deps = dependentsByHead.get(String(head.id)) || [];

        const spouseRow = deps.find((d) => d.relationship === 'Spouse');
        const spouseParts = spouseRow
          ? { firstName: spouseRow.firstName, lastName: spouseRow.lastName }
          : splitSpouseName(head.spouse_name);
        const spouse = spouseParts ? {
          name: fullName(spouseParts.firstName, spouseParts.lastName),
          phone: spouseRow?.phone || null
        } : null;

        const dependents = deps
          .filter((d) => d.relationship !== 'Spouse')
          .sort((a, b) => {
            if (a.dateOfBirth && b.dateOfBirth) return String(a.dateOfBirth).localeCompare(String(b.dateOfBirth));
            if (a.dateOfBirth) return -1;
            if (b.dateOfBirth) return 1;
            return compareNames(fullName(a.firstName, a.lastName), fullName(b.firstName, b.lastName));
          })
          .map((d) => ({
            name: fullName(d.firstName, d.lastName),
            relationship: d.relationship || null,
            phone: d.phone || null,
            age: calculateAge(d.dateOfBirth)
          }));

        // A spouse can also exist as a registered member linked via family_id
        // (e.g. both partners registered separately). If someone is already
        // shown as the spouse, don't list them again as a household member.
        const otherFamilyMembers = (linkedByHead.get(String(head.id)) || [])
          .filter((m) => !spouse || !sameName(fullName(m.first_name, m.last_name), spouse.name))
          .sort((a, b) => compareNames(fullName(a.first_name, a.last_name), fullName(b.first_name, b.last_name)))
          .map((m) => ({
            name: fullName(m.first_name, m.last_name),
            phone: m.phone_number || null,
            age: calculateAge(m.date_of_birth)
          }));

        totalSpouses += spouse ? 1 : 0;
        totalDependents += dependents.length;
        totalOtherMembers += otherFamilyMembers.length;

        const headName = fullName(head.first_name, head.last_name);
        let householdName;
        if (spouseParts && spouseParts.lastName &&
            compareNames(spouseParts.lastName, head.last_name) === 0) {
          householdName = `${head.first_name} & ${spouseParts.firstName} ${head.last_name} Household`;
        } else if (spouse) {
          householdName = `${headName} & ${spouse.name} Household`;
        } else {
          householdName = `${headName} Household`;
        }

        return {
          headId: head.id,
          householdName,
          head: { name: headName, phone: head.phone_number || null },
          spouse,
          dependents,
          otherFamilyMembers
        };
      });

    let generatedBy = null;
    if (req.user?.id) {
      const requester = await Member.findByPk(req.user.id, {
        attributes: ['first_name', 'last_name'],
        raw: true
      }).catch(() => null);
      if (requester) generatedBy = fullName(requester.first_name, requester.last_name);
    }
    if (!generatedBy) generatedBy = req.user?.email || 'Admin';

    res.json({
      success: true,
      data: {
        reportType: 'household_directory',
        generatedAt: new Date().toISOString(),
        generatedBy,
        summary: {
          totalHouseholds: households.length,
          totalHeads: households.length,
          totalSpouses,
          totalDependents,
          totalParishMembers: households.length + totalSpouses + totalDependents + totalOtherMembers
        },
        households
      }
    });
  } catch (error) {
    console.error('Error generating household directory report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate household directory report' });
  }
};

module.exports = {
  splitSpouseName,
  getMemberInformationReport,
  getHouseholdDirectoryReport
};
