// Utility: trim strings and coerce empty strings to null
function sanitizeInput(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined) continue;
    if (typeof v === 'string') {
      const t = v.trim();
      out[k] = t === '' ? null : t;
    } else {
      out[k] = v;
    }
  }
  return out;
}

module.exports = { sanitizeInput };
