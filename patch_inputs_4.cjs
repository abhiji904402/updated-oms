const fs = require('fs');
let code = fs.readFileSync('src/components/EditOrderModal.tsx', 'utf-8');

code = code.replace(
  "{!isOutletUser && (\n              <div className=\"flex flex-wrap gap-1.5 pb-1\">\n                {ITEM_PRESETS",
  "{!isOutletUser && !isManagerUser && (\n              <div className=\"flex flex-wrap gap-1.5 pb-1\">\n                {ITEM_PRESETS"
);

fs.writeFileSync('src/components/EditOrderModal.tsx', code);
console.log('Fixed presets in EditOrderModal');
