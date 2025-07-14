const fs = require('fs');
const path = require('path');

// Function to clean up payment amounts
function cleanPaymentAmount(amount) {
  if (!amount || amount.trim() === '') return '';
  
  // Remove quotation marks
  let cleaned = amount.replace(/"/g, '');
  
  // Remove extra spaces
  cleaned = cleaned.trim();
  
  // Handle special cases like " $-   " or " - "
  if (cleaned === '$-' || cleaned === '-' || cleaned === ' $-   ') {
    return '0';
  }
  
  // Remove dollar signs and commas for numeric processing
  const numericValue = cleaned.replace(/[$,]/g, '');
  
  // If it's a valid number, format it properly
  if (!isNaN(numericValue) && numericValue !== '') {
    return `$${parseFloat(numericValue).toFixed(2)}`;
  }
  
  return cleaned;
}

// Function to clean up dates
function cleanDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return '';
  
  let cleaned = dateStr.replace(/"/g, '').trim();
  
  // Handle various date formats
  if (cleaned === '' || cleaned === '-') return '';
  
  return cleaned;
}

// Function to clean up phone numbers
function cleanPhone(phone) {
  if (!phone || phone.trim() === '') return '';
  
  let cleaned = phone.replace(/"/g, '').trim();
  
  // Remove any non-digit characters except dashes and parentheses
  cleaned = cleaned.replace(/[^\d\-\(\)]/g, '');
  
  return cleaned;
}

// Function to clean up names
function cleanName(name) {
  if (!name || name.trim() === '') return '';
  
  let cleaned = name.replace(/"/g, '').trim();
  
  // Remove extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  return cleaned;
}

// Main function to process the CSV
function cleanupCSV(inputFile, outputFile) {
  try {
    console.log(`Reading CSV file: ${inputFile}`);
    const csvContent = fs.readFileSync(inputFile, 'utf8');
    
    // Split into lines
    const lines = csvContent.split('\n');
    
    // Process each line
    const cleanedLines = lines.map((line, index) => {
      if (index === 0) {
        // Keep header as is
        return line;
      }
      
      if (!line.trim()) {
        // Keep empty lines
        return line;
      }
      
      // Split by comma, but be careful with quoted fields
      const fields = [];
      let currentField = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          fields.push(currentField);
          currentField = '';
        } else {
          currentField += char;
        }
      }
      fields.push(currentField); // Add the last field
      
      // Clean up specific fields based on their position
      const cleanedFields = fields.map((field, fieldIndex) => {
        // Member Name (0), Spouse Name (1)
        if (fieldIndex === 0 || fieldIndex === 1) {
          return cleanName(field);
        }
        
        // Phone (2), Spouse Phone (3)
        if (fieldIndex === 2 || fieldIndex === 3) {
          return cleanPhone(field);
        }
        
        // Date (4) - keep as is
        if (fieldIndex === 4) {
          return field.trim();
        }
        
        // Paymt Method (5) - keep as is
        if (fieldIndex === 5) {
          return field.trim();
        }
        
        // Monthly Payment (6)
        if (fieldIndex === 6) {
          return cleanPaymentAmount(field);
        }
        
        // Total Amount Due (7)
        if (fieldIndex === 7) {
          return cleanPaymentAmount(field);
        }
        
        // Monthly payments (8-19: Jan through Dec)
        if (fieldIndex >= 8 && fieldIndex <= 19) {
          return cleanPaymentAmount(field);
        }
        
        // Total Collected amount (20)
        if (fieldIndex === 20) {
          return cleanPaymentAmount(field);
        }
        
        // Bal Due/Difference (21)
        if (fieldIndex === 21) {
          return cleanPaymentAmount(field);
        }
        
        // Paid up-to/Date (22)
        if (fieldIndex === 22) {
          return cleanDate(field);
        }
        
        // Number of Household (23)
        if (fieldIndex === 24) {
          return field.trim();
        }
        
        // Default: just trim
        return field.trim();
      });
      
      return cleanedFields.join(',');
    });
    
    // Write the cleaned CSV
    const cleanedContent = cleanedLines.join('\n');
    fs.writeFileSync(outputFile, cleanedContent, 'utf8');
    
    console.log(`✅ CSV cleaned successfully!`);
    console.log(`📁 Original file: ${inputFile}`);
    console.log(`📁 Cleaned file: ${outputFile}`);
    
    // Show some statistics
    const originalLines = lines.length;
    const cleanedLinesCount = cleanedLines.length;
    console.log(`📊 Processed ${originalLines} lines`);
    
  } catch (error) {
    console.error('❌ Error cleaning CSV:', error.message);
    process.exit(1);
  }
}

// Run the cleanup
const inputFile = path.join(__dirname, '..', 'Member-full-list-2024-dawit.csv');
const outputFile = path.join(__dirname, '..', 'Member-full-list-2024-dawit-cleaned.csv');

if (!fs.existsSync(inputFile)) {
  console.error(`❌ Input file not found: ${inputFile}`);
  process.exit(1);
}

cleanupCSV(inputFile, outputFile); 