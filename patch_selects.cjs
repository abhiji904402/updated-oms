const fs = require('fs');
let code = fs.readFileSync('src/components/EditOrderModal.tsx', 'utf-8');

code = code.replace(
  /disabled=\{isOutletUser\}\s*onChange=\{\(e\) => setOutlet/g,
  "disabled={isOutletUser || isManagerUser}\n                onChange={(e) => setOutlet"
);

code = code.replace(
  /onChange=\{\(e\) => setStatus/g,
  "disabled={isManagerUser}\n                onChange={(e) => setStatus"
);

fs.writeFileSync('src/components/EditOrderModal.tsx', code);
console.log('EditOrderModal selects patched.');
