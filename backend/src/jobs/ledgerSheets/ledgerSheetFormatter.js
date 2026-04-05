'use strict';

const HEADERS = [
  'Ledger Entry ID',
  'Entry Date',
  'Year',
  'Type',
  'Category',
  'Amount',
  'Payment Method',
  'Member ID',
  'Member Name',
  'Member Phone Number',
  'Payee Name',
  'Receipt Number',
  'Check Number',
  'Invoice Number',
  'Transaction ID',
  'Source System',
  'External ID',
  'Memo',
  'Statement Date',
  'Created At',
  'Updated At'
];

function formatTimestamp(value) {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function buildMemberName(member) {
  if (!member) {
    return '';
  }

  return [member.first_name, member.last_name].filter(Boolean).join(' ');
}

function toSheetRow(entry) {
  const year = entry.entry_date ? Number(String(entry.entry_date).slice(0, 4)) : '';

  return [
    entry.id ?? '',
    entry.entry_date || '',
    year,
    entry.type || '',
    entry.category || '',
    entry.amount != null ? Number(entry.amount) : '',
    entry.payment_method || '',
    entry.member_id || '',
    buildMemberName(entry.member),
    entry.member?.phone_number || '',
    entry.payee_name || '',
    entry.receipt_number || '',
    entry.check_number || '',
    entry.invoice_number || '',
    entry.transaction_id || '',
    entry.source_system || '',
    entry.external_id || '',
    entry.memo || '',
    entry.statement_date || '',
    formatTimestamp(entry.createdAt || entry.created_at),
    formatTimestamp(entry.updatedAt || entry.updated_at)
  ];
}

function toSheetValues(entries) {
  return [HEADERS, ...entries.map(toSheetRow)];
}

module.exports = {
  HEADERS,
  toSheetValues
};
