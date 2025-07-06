const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../members-2024.md');
const outputPath = path.join(__dirname, '../frontend/src/utils/members-2024.json');

// Helper to parse currency
function parseCurrency(value) {
  if (!value || value.trim() === '' || value === '-' || value === '$-') return 0;
  return parseFloat(value.replace(/[$,]/g, '')) || 0;
}

// Read the markdown file
const lines = fs.readFileSync(inputPath, 'utf-8').split('\n');
const members = [];

for (const line of lines) {
  // Skip header, empty, or total lines
  if (!line.trim() || line.toLowerCase().includes('total') || line.startsWith('No')) continue;
  const cols = line.split('\t');
  if (cols.length < 5) continue;

  // Map columns to fields (adjust indices as needed)
  const [id, name, phone, year, paymentMethod, monthlyPayment, totalAmountDue,
    jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec,
    totalCollected, balanceDue, paidUpTo, householdCount
  ] = cols;

  members.push({
    id: parseInt(id),
    name: name.trim(),
    phone: phone ? phone.trim() : '',
    year: year ? year.trim() : '',
    paymentMethod: paymentMethod ? paymentMethod.trim() : '',
    monthlyPayment: parseCurrency(monthlyPayment),
    totalAmountDue: parseCurrency(totalAmountDue),
    jan: parseCurrency(jan),
    feb: parseCurrency(feb),
    mar: parseCurrency(mar),
    apr: parseCurrency(apr),
    may: parseCurrency(may),
    jun: parseCurrency(jun),
    jul: parseCurrency(jul),
    aug: parseCurrency(aug),
    sep: parseCurrency(sep),
    oct: parseCurrency(oct),
    nov: parseCurrency(nov),
    dec: parseCurrency(dec),
    totalCollected: parseCurrency(totalCollected),
    balanceDue: parseCurrency(balanceDue),
    paidUpTo: paidUpTo ? paidUpTo.trim() : '',
    householdCount: parseInt(householdCount) || 0
  });
}

fs.writeFileSync(outputPath, JSON.stringify(members, null, 2));
console.log(`Parsed ${members.length} members to ${outputPath}`); 