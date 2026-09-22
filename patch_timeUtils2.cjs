const fs = require('fs');
let code = fs.readFileSync('src/lib/timeUtils.ts', 'utf-8');

code = code.replace(
  "function parseDateTime(dateStr: string, timeStr: string): Date | null {",
  "function parseDateTime(dateStr: any, timeStr: string): Date | null {"
);

code = code.replace(
  "let cleanDate = dateStr.trim();",
  "let cleanDate = typeof dateStr === 'string' ? dateStr.trim() : (dateStr instanceof Date ? dateStr.toISOString().split('T')[0] : (dateStr && (dateStr as any).toDate ? (dateStr as any).toDate().toISOString().split('T')[0] : String(dateStr).trim()));"
);

fs.writeFileSync('src/lib/timeUtils.ts', code);
console.log('Fixed timeUtils parseDateTime');
