export function analyzeDocumentText(text, members = []) {
  const t = text.toUpperCase();
  const metadata = {
    documentType: 'Other',
    category: 'Other',
    documentNumber: '',
    ownerName: '',
    ownerId: '',
    issueDate: '',
    expiryDate: ''
  };

  // 1. Detect Document Type & Category
  if (t.includes('AADHAAR') || t.includes('UIDAI') || t.includes('GOVERNMENT OF INDIA')) {
    metadata.documentType = 'Aadhaar Card';
    metadata.category = 'Identity';
    const aadhaarMatch = text.match(/\d{4}\s\d{4}\s\d{4}/);
    if (aadhaarMatch) metadata.documentNumber = aadhaarMatch[0];
  } 
  else if (t.includes('INCOME TAX DEPARTMENT') || t.includes('PERMANENT ACCOUNT NUMBER') || t.includes('GOVT. OF INDIA')) {
    metadata.documentType = 'PAN Card';
    metadata.category = 'Identity';
    const panMatch = text.match(/[A-Z]{5}\d{4}[A-Z]{1}/);
    if (panMatch) metadata.documentNumber = panMatch[0];
  } 
  else if (t.includes('PASSPORT') || t.includes('REPUBLIC OF INDIA')) {
    metadata.documentType = 'Passport';
    metadata.category = 'Identity';
    const passMatch = text.match(/[A-Z]{1}\d{7}/);
    if (passMatch) metadata.documentNumber = passMatch[0];
  } 
  else if (t.includes('DRIVING LICENCE') || t.includes('UNION OF INDIA') || t.includes('TRANSPORT DEPARTMENT')) {
    metadata.documentType = 'Driving Licence';
    metadata.category = 'Identity';
    const dlMatch = text.match(/[A-Z]{2}\d{2}\s?\d{11}/);
    if (dlMatch) metadata.documentNumber = dlMatch[0];
  }
  else if (t.includes('CERTIFICATE OF REGISTRATION') || t.includes('VEHICLE') || t.includes('CHASSIS NO')) {
    metadata.documentType = 'Vehicle RC';
    metadata.category = 'Vehicles';
    const rcMatch = text.match(/[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}/);
    if (rcMatch) metadata.documentNumber = rcMatch[0];
  }
  else if (t.includes('INSURANCE') || t.includes('POLICY') || t.includes('PREMIUM')) {
    metadata.documentType = 'Insurance';
    metadata.category = 'Insurance';
  }
  else if (t.includes('BANK') || t.includes('PASSBOOK') || t.includes('ACCOUNT NO')) {
    metadata.documentType = 'Bank Passbook';
    metadata.category = 'Banking';
  }
  else if (t.includes('UNIVERSITY') || t.includes('BOARD OF') || t.includes('DEGREE') || t.includes('CERTIFICATE')) {
    metadata.documentType = 'Educational Document';
    metadata.category = 'Education';
  }
  else if (t.includes('HOSPITAL') || t.includes('CLINIC') || t.includes('PRESCRIPTION') || t.includes('DIAGNOSTIC')) {
    metadata.documentType = 'Medical Document';
    metadata.category = 'Medical';
  }

  // 2. Extract Dates (DD/MM/YYYY or DD-MM-YYYY)
  const dateMatches = text.match(/\d{2}[\/\-]\d{2}[\/\-]\d{4}/g);
  if (dateMatches && dateMatches.length > 0) {
    // Attempt to guess issue vs expiry by sorting
    const sorted = [...dateMatches].sort((a,b) => {
      const d1 = new Date(a.split(/[\/\-]/).reverse().join('-'));
      const d2 = new Date(b.split(/[\/\-]/).reverse().join('-'));
      return d1 - d2;
    });
    
    // Convert DD/MM/YYYY to YYYY-MM-DD for <input type="date">
    const formatForInput = (dStr) => {
      const parts = dStr.split(/[\/\-]/);
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    };

    if (sorted.length === 1) {
      metadata.issueDate = formatForInput(sorted[0]);
    } else {
      metadata.issueDate = formatForInput(sorted[0]);
      metadata.expiryDate = formatForInput(sorted[sorted.length - 1]);
    }
  }

  // 3. Extract Owner by matching member names
  if (members && members.length > 0) {
    for (const member of members) {
      const names = member.name.toUpperCase().split(' ');
      // Simple match: if first name and last name both appear in the document
      if (names.every(n => t.includes(n))) {
        metadata.ownerName = member.name;
        metadata.ownerId = member.id;
        break;
      }
    }
  }

  return metadata;
}

export function generateFilename(metadata) {
  const owner = metadata.ownerName ? metadata.ownerName.split(' ')[0] : 'Document';
  const type = metadata.documentType.replace(' ', '');
  const year = metadata.issueDate ? metadata.issueDate.substring(0,4) : new Date().getFullYear();
  return `${owner}_${type}_${year}`.replace(/[^a-zA-Z0-9_]/g, '');
}
