'use strict';

const { Op } = require('sequelize');
const { LedgerEntry, Member } = require('../../models');

function getYearBounds(year) {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`
  };
}

async function listAvailableYears() {
  const entries = await LedgerEntry.findAll({
    attributes: ['entry_date'],
    raw: true,
    order: [['entry_date', 'ASC']]
  });

  const years = new Set();
  for (const entry of entries) {
    if (entry.entry_date) {
      years.add(Number(String(entry.entry_date).slice(0, 4)));
    }
  }

  return Array.from(years).sort((a, b) => a - b);
}

async function fetchLedgerEntriesForYear(year) {
  const { start, end } = getYearBounds(year);

  return LedgerEntry.findAll({
    where: {
      entry_date: {
        [Op.between]: [start, end]
      }
    },
    include: [
      {
        model: Member,
        as: 'member',
        attributes: ['id', 'first_name', 'last_name', 'phone_number'],
        required: false
      }
    ],
    order: [
      ['entry_date', 'ASC'],
      ['id', 'ASC']
    ]
  });
}

module.exports = {
  fetchLedgerEntriesForYear,
  listAvailableYears
};
