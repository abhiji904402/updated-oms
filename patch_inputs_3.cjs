const fs = require('fs');
let code = fs.readFileSync('src/components/EditOrderModal.tsx', 'utf-8');

code = code.replace(
  /value=\{orderDate\}\s*disabled=\{isOutletUser\}/g,
  "value={orderDate}\n                disabled={isOutletUser || isManagerUser}"
);

code = code.replace(
  /value=\{orderTime\}\s*disabled=\{isOutletUser\}/g,
  "value={orderTime}\n                disabled={isOutletUser || isManagerUser}"
);

fs.writeFileSync('src/components/EditOrderModal.tsx', code);
console.log('Fixed dates in EditOrderModal');
