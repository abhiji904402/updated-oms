const fs = require('fs');
let code = fs.readFileSync('src/lib/orderLogic.ts', 'utf-8');

code = code.replace(
  "const clean = dateStr.trim();",
  "const clean = typeof dateStr === 'string' ? dateStr.trim() : (dateStr instanceof Date ? dateStr.toISOString().split('T')[0] : (dateStr && (dateStr as any).toDate ? (dateStr as any).toDate().toISOString().split('T')[0] : String(dateStr).trim()));"
);

fs.writeFileSync('src/lib/orderLogic.ts', code);
console.log('Fixed getNormalizedDateStr');
