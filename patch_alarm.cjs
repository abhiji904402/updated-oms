const fs = require('fs');
let code = fs.readFileSync('src/components/ManagerAlarmSystem.tsx', 'utf-8');

code = code.replace(
  "import { isOrderForToday, getNormalizedDateStr } from '../lib/orderLogic';",
  "import { isOrderForToday, getNormalizedDateStr } from '../lib/orderLogic';\nimport { getTodayDateStr } from '../lib/timeUtils';"
);

code = code.replace(
  "const todayStr = getNormalizedDateStr(now);",
  "const todayStr = getTodayDateStr(now);"
);

fs.writeFileSync('src/components/ManagerAlarmSystem.tsx', code);
console.log('ManagerAlarmSystem.tsx patched');
