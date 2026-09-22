const fs = require('fs');
let code = fs.readFileSync('src/components/EditOrderModal.tsx', 'utf-8');

code = code.replace(
  "{!isOutletUser && (\n                      <input type=\"file\"",
  "{!isOutletUser && !isManagerUser && (\n                      <input type=\"file\""
);

// update label cursor and visual state
code = code.replace(
  "className={`flex-1 ${isOutletUser ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-[#1a1e36]'}",
  "className={`flex-1 ${(isOutletUser || isManagerUser) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-[#1a1e36]'}"
);

fs.writeFileSync('src/components/EditOrderModal.tsx', code);
console.log('Fixed file input disabled');
