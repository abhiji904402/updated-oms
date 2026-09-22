const fs = require('fs');
let code = fs.readFileSync('src/components/EditOrderModal.tsx', 'utf-8');

code = code.replace(
  /value=\{informedBy\}\s*disabled=\{isOutletUser\}/g,
  "value={informedBy}\n                disabled={isOutletUser || isManagerUser}"
);

code = code.replace(
  /value=\{advanceBillNumber\}\s*disabled=\{isOutletUser\}/g,
  "value={advanceBillNumber}\n                disabled={isOutletUser || isManagerUser}"
);

code = code.replace(
  /value=\{finalBillNumber\}\s*disabled=\{isOutletUser\}/g,
  "value={finalBillNumber}\n                disabled={isOutletUser || isManagerUser}"
);

fs.writeFileSync('src/components/EditOrderModal.tsx', code);
console.log('Fixed more inputs in EditOrderModal');
