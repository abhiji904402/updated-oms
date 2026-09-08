const fs = require('fs');
let code = fs.readFileSync('src/lib/orderLogic.ts', 'utf-8');

code = code.replace(
  "export const getNormalizedDateStr = (dateStr?: string | null): string => {",
  "export const getNormalizedDateStr = (dateStr?: any): string => {"
);

fs.writeFileSync('src/lib/orderLogic.ts', code);
console.log('Fixed orderLogic types');
