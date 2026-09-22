const fs = require('fs');
let content = fs.readFileSync('src/components/EditOrderModal.tsx', 'utf-8');

const oldFunc = `function convertTo24Hour(time12h: string): string {
  if (!time12h) return '';
  const match = time12h.match(/^(\\d{1,2}):(\\d{2})(?::\\d{2})?\\s*(AM|PM|am|pm)$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2];
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    const hStr = h < 10 ? \`0\${h}\` : \`\${h}\`;
    return \`\${hStr}:\${m}\`;
  }
  const match24 = time12h.match(/^(\\d{1,2}):(\\d{2})/);
  if (match24) return \`\${match24[1].padStart(2, '0')}:\${match24[2]}\`;
  return '';
}`;

if (content.includes(oldFunc)) {
  content = content.replace(oldFunc, '');
}

if (content.includes("import { formatTo12Hour } from '../lib/timeUtils';") && !content.includes("convertTo24Hour }")) {
  content = content.replace("import { formatTo12Hour } from '../lib/timeUtils';", "import { formatTo12Hour, convertTo24Hour } from '../lib/timeUtils';");
}

fs.writeFileSync('src/components/EditOrderModal.tsx', content, 'utf-8');
console.log("Fixed EditOrderModal");
