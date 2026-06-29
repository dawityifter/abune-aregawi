'use strict';

const RECEIPT_NUMBER_MESSAGE = 'Receipt number must contain digits only.';

function normalizeReceiptNumber(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function isReceiptNumberValid(value) {
  const normalized = normalizeReceiptNumber(value);
  return !normalized || /^\d+$/.test(normalized);
}

function validateReceiptNumber(value) {
  const normalized = normalizeReceiptNumber(value);
  if (normalized && !/^\d+$/.test(normalized)) {
    return { valid: false, normalized, message: RECEIPT_NUMBER_MESSAGE };
  }

  return { valid: true, normalized, message: null };
}

module.exports = {
  RECEIPT_NUMBER_MESSAGE,
  normalizeReceiptNumber,
  isReceiptNumberValid,
  validateReceiptNumber
};
