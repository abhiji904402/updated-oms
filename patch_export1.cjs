const fs = require('fs');
let code = fs.readFileSync('src/lib/exportUtils.ts', 'utf-8');

if (!code.includes('getExpectedTimestamp')) {
  code = code.replace(
    "import { formatTo12Hour, getDeliveryTimeInfo } from './timeUtils';",
    "import { formatTo12Hour, getDeliveryTimeInfo, getExpectedTimestamp } from './timeUtils';"
  );
}

fs.writeFileSync('src/lib/exportUtils.ts', code);
console.log('Import added');
