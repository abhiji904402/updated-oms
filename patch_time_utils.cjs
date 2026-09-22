const fs = require('fs');
let content = fs.readFileSync('src/lib/timeUtils.ts', 'utf-8');

if (!content.includes('convertTo24Hour')) {
  content += `

export function convertTo24Hour(time12h?: string | null): string {
  if (!time12h) return '';
  const str = time12h.trim();
  if (!str) return '';
  const match = str.match(/^(\\d{1,2}):(\\d{2})(?::\\d{2})?\\s*(AM|PM|am|pm)$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2];
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    const hStr = h < 10 ? \`0\${h}\` : \`\${h}\`;
    return \`\${hStr}:\${m}\`;
  }
  const match24 = str.match(/^(\\d{1,2}):(\\d{2})/);
  if (match24) return \`\${match24[1].padStart(2, '0')}:\${match24[2]}\`;
  return '';
}
`;
  fs.writeFileSync('src/lib/timeUtils.ts', content, 'utf-8');
  console.log("Added convertTo24Hour to timeUtils.ts");
}
