export const digitsOnly = (value: string) => value.replace(/\D/g, '');

export const isReceiptNumberValid = (value: string) => value.trim() === '' || /^\d+$/.test(value.trim());

export const receiptNumberHelpText = 'Receipt numbers can contain digits only.';
