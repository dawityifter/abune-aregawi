'use strict';

const { Op } = require('sequelize');
const { LedgerEntry, Member } = require('../../models');

function extractYear(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isNaN(timestamp) ? null : value.getUTCFullYear();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 1000 && value <= 9999 ? value : null;
  }

  const asString = String(value).trim();
  const match = asString.match(/^(\d{4})/);
  if (match) {
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

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
    const year = extractYear(entry.entry_date);
    if (year !== null) {
      years.add(year);
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
  extractYear,
  fetchLedgerEntriesForYear,
  listAvailableYears
};
