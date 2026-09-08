const fs = require('fs');
let code = fs.readFileSync('src/components/EditOrderModal.tsx', 'utf-8');

code = code.replace(
  /value=\{deliveryDate\}\s*disabled=\{isOutletUser\}/g,
  "value={deliveryDate}\n                disabled={isOutletUser || isManagerUser}"
);

fs.writeFileSync('src/components/EditOrderModal.tsx', code);
console.log('Fixed deliveryDate disabled');
