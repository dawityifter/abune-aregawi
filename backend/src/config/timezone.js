const moment = require('moment-timezone');

// Set default timezone to Central Time (CST/CDT)
const TIMEZONE = 'America/Chicago';
moment.tz.setDefault(TIMEZONE);

/**
 * Get current date/time in CST timezone
 * @returns {Date} Current date in CST
 */
function now() {
  return moment().tz(TIMEZONE).toDate();
}

/**
 * Parse a date string in CST timezone
 * @param {string} dateString - Date string to parse
 * @param {string} format - Optional format string
 * @returns {Date} Parsed date in CST
 */
function parseDate(dateString, format = null) {
  if (!dateString) return null;
  
  if (format) {
    return moment.tz(dateString, format, TIMEZONE).toDate();
  }
  return moment.tz(dateString, TIMEZONE).toDate();
}

/**
 * Format a date for database storage (YYYY-MM-DD)
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
function formatForDB(date) {
  if (!date) return null;
  return moment(date).tz(TIMEZONE).format('YYYY-MM-DD');
}

/**
 * Format a datetime for database storage (YYYY-MM-DD HH:mm:ss)
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted datetime string
 */
function formatDateTimeForDB(date) {
  if (!date) return null;
  return moment(date).tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss');
}

/**
 * Format a date for display
 * @param {Date|string} date - Date to format
 * @param {string} format - Optional format string (default: 'MMM DD, YYYY')
 * @returns {string} Formatted date string
 */
function formatForDisplay(date, format = 'MMM DD, YYYY') {
  if (!date) return '';
  return moment(date).tz(TIMEZONE).format(format);
}

/**
 * Get start of day in CST
 * @param {Date|string} date - Date to get start of day for
 * @returns {Date} Start of day in CST
 */
function startOfDay(date = null) {
  const d = date ? moment(date).tz(TIMEZONE) : moment().tz(TIMEZONE);
  return d.startOf('day').toDate();
}

/**
 * Get end of day in CST
 * @param {Date|string} date - Date to get end of day for
 * @returns {Date} End of day in CST
 */
function endOfDay(date = null) {
  const d = date ? moment(date).tz(TIMEZONE) : moment().tz(TIMEZONE);
  return d.endOf('day').toDate();
}

/**
 * Get start of week (Monday) in CST
 * @param {Date|string} date - Date to get start of week for
 * @returns {Date} Start of week in CST
 */
function startOfWeek(date = null) {
  const d = date ? moment(date).tz(TIMEZONE) : moment().tz(TIMEZONE);
  return d.startOf('isoWeek').toDate(); // ISO week starts on Monday
}

/**
 * Get end of week (Sunday) in CST
 * @param {Date|string} date - Date to get end of week for
 * @returns {Date} End of week in CST
 */
function endOfWeek(date = null) {
  const d = date ? moment(date).tz(TIMEZONE) : moment().tz(TIMEZONE);
  return d.endOf('isoWeek').toDate();
}

/**
 * Get start of month in CST
 * @param {Date|string} date - Date to get start of month for
 * @returns {Date} Start of month in CST
 */
function startOfMonth(date = null) {
  const d = date ? moment(date).tz(TIMEZONE) : moment().tz(TIMEZONE);
  return d.startOf('month').toDate();
}

/**
 * Get end of month in CST
 * @param {Date|string} date - Date to get end of month for
 * @returns {Date} End of month in CST
 */
function endOfMonth(date = null) {
  const d = date ? moment(date).tz(TIMEZONE) : moment().tz(TIMEZONE);
  return d.endOf('month').toDate();
}

/**
 * Get start of year in CST
 * @param {number} year - Year to get start of
 * @returns {Date} Start of year in CST
 */
function startOfYear(year = null) {
  const y = year || moment().tz(TIMEZONE).year();
  return moment.tz(`${y}-01-01`, TIMEZONE).startOf('day').toDate();
}

/**
 * Get end of year in CST
 * @param {number} year - Year to get end of
 * @returns {Date} End of year in CST
 */
function endOfYear(year = null) {
  const y = year || moment().tz(TIMEZONE).year();
  return moment.tz(`${y}-12-31`, TIMEZONE).endOf('day').toDate();
}

/**
 * Check if a date is valid
 * @param {Date|string} date - Date to validate
 * @returns {boolean} True if valid
 */
function isValid(date) {
  return moment(date).isValid();
}

/**
 * Get moment instance in CST timezone
 * @param {Date|string} date - Optional date
 * @returns {moment.Moment} Moment instance in CST
 */
function getMoment(date = null) {
  return date ? moment(date).tz(TIMEZONE) : moment().tz(TIMEZONE);
}

module.exports = {
  TIMEZONE,
  now,
  parseDate,
  formatForDB,
  formatDateTimeForDB,
  formatForDisplay,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isValid,
  getMoment
};
