const fs = require('fs');
let content = fs.readFileSync('src/components/EditOrderModal.tsx', 'utf-8');

const regex = /import { formatTo12Hour } from '\.\.\/lib\/timeUtils';/m;

const newImports = `import { formatTo12Hour } from '../lib/timeUtils';

function convertTo24Hour(time12h: string): string {
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
}
`;

content = content.replace(regex, newImports);

const orderTimeRegex = /<input type="text"\s+value=\{orderTime\}\s+disabled=\{isOutletUser \|\| isManagerUser\}\s+onChange=\{\(e\) => setOrderTime\(e.target.value\)\}\s+placeholder="10:30 AM"/m;

const orderTimeNew = `<input type="time"
                value={convertTo24Hour(orderTime)}
                disabled={isOutletUser || isManagerUser}
                onChange={(e) => setOrderTime(formatTo12Hour(e.target.value))}
                placeholder="10:30 AM"`;

content = content.replace(orderTimeRegex, orderTimeNew);

const expectTimeRegex = /<input type="text"\s+value=\{expectedDeliveryTime\}\s+disabled=\{isOutletUser \|\| isManagerUser\}\s+onChange=\{\(e\) => setExpectedDeliveryTime\(e.target.value\)\}\s+placeholder="18:00"/m;

const expectTimeNew = `<input type="time"
                value={convertTo24Hour(expectedDeliveryTime)}
                disabled={isOutletUser || isManagerUser}
                onChange={(e) => setExpectedDeliveryTime(formatTo12Hour(e.target.value))}
                placeholder="18:00"`;

content = content.replace(expectTimeRegex, expectTimeNew);

fs.writeFileSync('src/components/EditOrderModal.tsx', content, 'utf-8');
console.log("Patched EditOrderModal");
