export function formatPhoneNumber(value: string) {
  const cleaned = value.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
  if (!match) return value;
  let formatted = '';
  if (match[1]) {
    formatted = `(${match[1]}`;
    if (match[1].length === 3) {
      formatted += ')';
    }
  }
  if (match[2]) {
    formatted += match[2].length > 0 ? ` ${match[2]}` : '';
  }
  if (match[3]) {
    formatted += match[3].length > 0 ? `-${match[3]}` : '';
  }
  return formatted.trim();
} 