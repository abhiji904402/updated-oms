const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf-8');

code = code.replace(
  "remarks: string;",
  "remarks: string;\n  late_reason?: string;"
);

fs.writeFileSync('src/types.ts', code);
console.log('Added late_reason to types.ts');
