const fs = require('fs');
let code = fs.readFileSync('src/lib/timeUtils.ts', 'utf-8');

// Inside getCountdownInfo we need to parse Date objects safely too.
code = code.replace(
  "const dateStr = order.delivery_date || order.order_date || new Date().toISOString().split('T')[0];",
  "let dateStr: any = order.delivery_date || order.order_date || new Date().toISOString().split('T')[0];\n  if (typeof dateStr !== 'string') {\n    if (dateStr && dateStr.toDate) dateStr = dateStr.toDate().toISOString().split('T')[0];\n    else if (dateStr instanceof Date) dateStr = dateStr.toISOString().split('T')[0];\n    else dateStr = String(dateStr);\n  }"
);

fs.writeFileSync('src/lib/timeUtils.ts', code);
console.log('Fixed timeUtils getCountdownInfo');
